import XLSX from 'xlsx';
import { parse } from 'csv-parse/sync';

import dao from '../dao/medicine.dao.js';
import MedicineImport from '../models/medicine-import.model.js';
import MedicineService from '../services/medicine.service.js';
import pickFields from '../utils/pick-fields.js';
import { parseVNNumber, normalizeHeaderKey, isBlankCell, MAX_IMPORT_ROWS } from '../utils/import-parse.js';

import errorStatus from '../utils/error-status.js';
const FIELDS = ['name', 'category', 'unit', 'price'];

class MedicineController {
  async create(req, res) {
    try {
      const result = await dao.create(pickFields(req.body, FIELDS));
      res.status(201).json(result);
    } catch (err) {
      res.status(errorStatus(err)).json({ error: err.message });
    }
  };

  async findAll(req, res) {
    try {
      const filter = {};
      if (req.query.disabled !== undefined) {
        filter.disabled = req.query.disabled === 'true';
      }
      const result = await dao.findAll(filter);

      // Tính số lượng còn lại cho mỗi thuốc từ medicine imports
      const medicinesWithInventory = await Promise.all(
        result.map(async (medicine) => {
          const medicineId = medicine._id;

          const inventory = await MedicineImport.aggregate([
            {
              $match: {
                medicine_id: medicineId,
                disabled: false,
                remaining: { $gt: 0 }
              }
            },
            {
              $group: {
                _id: null,
                total_remaining: { $sum: '$remaining' }
              }
            }
          ]);

          const totalRemaining = inventory.length > 0 ? inventory[0].total_remaining : 0;

          return {
            ...medicine,
            total_remaining: totalRemaining
          };
        })
      );

      res.json(medicinesWithInventory);
    } catch (err) {
      res.status(errorStatus(err)).json({ error: err.message });
    }
  };

  async findById(req, res) {
    try {
      const result = await dao.findById(req.params.id);
      if (!result) return res.status(404).json({ message: 'Not found' });
      res.json(result);
    } catch (err) {
      res.status(errorStatus(err)).json({ error: err.message });
    }
  };

  async update(req, res) {
    try {
      const result = await dao.update(req.params.id, pickFields(req.body, FIELDS));
      res.json(result);
    } catch (err) {
      res.status(errorStatus(err)).json({ error: err.message });
    }
  };

  async remove(req, res) {
    try {
      if (req.query && req.query.hard === 'true') {
        // Xóa vĩnh viễn chỉ áp dụng cho thuốc đã ở thùng rác (giống xóa hàng loạt)
        const medicine = await dao.model.findById(req.params.id);
        if (!medicine) return res.status(404).json({ error: 'Không tìm thấy thuốc' });
        if (!medicine.disabled) {
          return res.status(400).json({ error: 'Chỉ xóa vĩnh viễn được thuốc đã bị xóa (trong thùng rác)' });
        }
        await MedicineService.deleteCascade(req.params.id, true);
        return res.json({ message: 'Permanently deleted' });
      }
      await MedicineService.deleteCascade(req.params.id);
      res.json({ message: 'Deleted with cascade' });
    } catch (err) {
      res.status(errorStatus(err)).json({ error: err.message });
    }
  };

  async restore(req, res) {
    try {
      await MedicineService.restoreCascade(req.params.id);
      res.json({ message: 'Medicine restore with cascade' });
    } catch (err) {
      res.status(errorStatus(err)).json({ error: err.message });
    }
  };

  // Kế thừa
  async bulkDelete(req, res) {
    try {
      // Express 5: req.body là undefined nếu request không có body JSON
      const ids = req.body?.ids;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'Chưa chọn thuốc cần xóa' });
      }
      if (!ids.every((id) => typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id))) {
        return res.status(400).json({ error: 'Danh sách mã thuốc không hợp lệ' });
      }

      if (req.query && req.query.hard === 'true') {
        if (typeof dao.hardDeleteMany === 'function') {
          await dao.hardDeleteMany(ids);
          return res.json({ message: 'Permanently deleted' });
        } else {
          for (const id of ids) {
            await dao.hardDelete(id);
          }
          return res.json({ message: 'Permanently deleted' });
        }
      }

      if (typeof dao.deleteMany === 'function') {
        await dao.deleteMany(ids);
      } else {
        for (const id of ids) {
          await dao.delete(id);
        }
      }
      res.json({ message: 'Deleted' });
    } catch (err) {
      res.status(errorStatus(err)).json({ error: err.message });
    }
  };

  async import(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Không có file được upload' });
      }

      const file = req.file;
      let medicines = [];

      // Chuẩn hóa key header: bỏ dấu tiếng Việt (kể cả "đ"), khoảng trắng, ký tự đặc biệt
      const normalizeKey = normalizeHeaderKey;

      // Nhận diện cột theo header đã chuẩn hóa: khớp chính xác hoặc theo tiền tố,
      // tránh includes lỏng (vd tiêu đề "BẢNG GIÁ THUỐC" bị nhận nhầm là cột giá)
      const matchHeader = (norm) => {
        if (!norm) return null;
        if (["tenthuoc", "thuoc", "ten", "name", "medicine", "medicinename"].includes(norm) || norm.startsWith("tenthuoc")) return "name";
        if (norm.startsWith("danhmuc") || ["category", "categories", "loaithuoc", "nhomthuoc"].includes(norm)) return "category";
        if (norm.startsWith("donvi") || ["dvt", "unit"].includes(norm)) return "unit";
        if (/^(gia|giaban|giabanle|dongia|price|saleprice)(vnd|d)?$/.test(norm)) return "price";
        return null;
      };

      // Xử lý file Excel (.xlsx, .xls)
      if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.mimetype === 'application/vnd.ms-excel') {
        const workbook = XLSX.read(file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Đọc dạng mảng 2D để tự xác định dòng header, bỏ qua dòng tiêu đề như "DỮ LIỆU IMPORT..."
        const rows = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          defval: "",
        });

        if (rows.length === 0) {
          return res.status(400).json({ error: 'File không chứa dữ liệu hợp lệ' });
        }

        // Tìm dòng header: cùng một dòng phải có cả cột tên thuốc và cột giá
        let headerRowIndex = -1;
        let fallbackHeaderIndex = -1; // dùng khi không match được theo tên cột
        let colIndex = {
          name: -1,
          category: -1,
          unit: -1,
          price: -1,
        };

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          if (!Array.isArray(row)) continue;

          // Ghi nhận dòng đầu tiên có dữ liệu làm fallback header (trong trường hợp header bị merge ô, khó nhận dạng)
          const hasAnyValue = row.some((cell) => String(cell || "").trim() !== "");
          if (hasAnyValue && fallbackHeaderIndex === -1) {
            fallbackHeaderIndex = i;
          }

          // Reset cho mỗi dòng để không cộng dồn cột từ dòng tiêu đề phía trên
          const current = { name: -1, category: -1, unit: -1, price: -1 };
          row.forEach((cell, idx) => {
            const field = matchHeader(normalizeKey(cell));
            if (field && current[field] === -1) current[field] = idx;
          });

          if (current.name !== -1 && current.price !== -1) {
            colIndex = current;
            headerRowIndex = i;
            break;
          }
        }

        // Nếu không tìm được header theo tên cột → fallback sang dòng đầu tiên có dữ liệu và giả định thứ tự cột: tên, danh mục, đơn vị, giá
        if (headerRowIndex === -1) {
          if (fallbackHeaderIndex !== -1) {
            headerRowIndex = fallbackHeaderIndex;
            colIndex = {
              name: 0,
              category: 1,
              unit: 2,
              price: 3,
            };
            console.warn(
              "⚠️ Không nhận diện được header theo tên cột, dùng fallback header tại dòng",
              headerRowIndex,
              "với mapping mặc định (name, category, unit, price)"
            );
          } else {
            console.error("Không tìm thấy dòng header hợp lệ trong file Excel");
            return res.status(400).json({
              error:
                "Không tìm thấy dòng tiêu đề (header) hợp lệ. Vui lòng kiểm tra lại file Excel theo đúng cấu trúc mẫu.",
            });
          }
        }

        console.log("📄 Medicine import header row index:", headerRowIndex);
        console.log("📄 Medicine column index:", colIndex);

        // Từ dòng sau header trở đi là data
        medicines = [];
        for (let i = headerRowIndex + 1; i < rows.length; i++) {
          const row = rows[i];
          if (!Array.isArray(row)) continue;

          const name = (colIndex.name !== -1 ? row[colIndex.name] : "") || "";
          const categoryStr = (colIndex.category !== -1 ? row[colIndex.category] : "") || "";
          const unit = (colIndex.unit !== -1 ? row[colIndex.unit] : "") || "";
          const priceRaw = colIndex.price !== -1 ? row[colIndex.price] : "";

          // Xử lý category: có thể là string hoặc string phân cách bởi dấu phẩy
          let categories = [];
          if (categoryStr) {
            categories = String(categoryStr).split(',').map(c => c.trim()).filter(c => c);
            // Giới hạn tối đa 3 danh mục
            if (categories.length > 3) {
              categories = categories.slice(0, 3);
            }
          }

          // Giá bán: hỗ trợ "42.000", "1.250.000,5", "42,000 đ"; NaN/âm để service báo lỗi theo dòng
          const price = parseVNNumber(priceRaw);

          // Bỏ qua các dòng trống hoàn toàn
          if (!String(name).trim() && !String(unit).trim() && isBlankCell(priceRaw)) {
            continue;
          }

          if (medicines.length >= MAX_IMPORT_ROWS) {
            return res.status(400).json({ error: `File có hơn ${MAX_IMPORT_ROWS} dòng dữ liệu. Vui lòng chia nhỏ file, tối đa ${MAX_IMPORT_ROWS} dòng mỗi lần import.` });
          }

          medicines.push({
            name: String(name).trim(),
            category: categories,
            unit: String(unit).trim(),
            price: price,
            // i là index 0-based trong sheet, +1 để ra số dòng thực tế trong Excel
            rowNumber: i + 1
          });
        }
      }
      // Xử lý file CSV
      else if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
        const records = parse(file.buffer.toString('utf-8'), {
          columns: true,
          skip_empty_lines: true,
          trim: true
        });

        const dataCount = records.filter((r) => Object.values(r).some((v) => !isBlankCell(v))).length;
        if (dataCount > MAX_IMPORT_ROWS) {
          return res.status(400).json({ error: `File có ${dataCount} dòng dữ liệu, vượt quá giới hạn ${MAX_IMPORT_ROWS} dòng mỗi lần import. Vui lòng chia nhỏ file.` });
        }

        medicines = records.map((row, index) => {
          const name = row['Tên thuốc'] || row['Tên'] || row['name'] || row['Name'] || '';
          const categoryStr = row['Danh mục'] || row['Category'] || row['category'] || '';
          const unit = row['Đơn vị'] || row['Unit'] || row['unit'] || '';

          // Tìm giá với nhiều tên cột có thể - tìm trong tất cả keys
          let priceRaw = '';
          const priceKeys = ['Giá', 'Giá (VNĐ)', 'Giá(VNĐ)', 'Price', 'price', 'Gia', 'gia', 'GIA'];
          for (const key of priceKeys) {
            if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
              priceRaw = row[key];
              break;
            }
          }

          // Nếu không tìm thấy, tìm trong tất cả keys có chứa "giá" hoặc "price"
          if (!priceRaw) {
            const allKeys = Object.keys(row);
            const priceKey = allKeys.find(key =>
              key.toLowerCase().includes('giá') ||
              key.toLowerCase().includes('price') ||
              key.toLowerCase().includes('gia')
            );
            if (priceKey) {
              priceRaw = row[priceKey];
            }
          }

          let categories = [];
          if (categoryStr) {
            categories = categoryStr.split(',').map(c => c.trim()).filter(c => c);
            if (categories.length > 3) {
              categories = categories.slice(0, 3);
            }
          }

          // Giá bán: hỗ trợ "42.000", "1.250.000,5", "42,000 đ"; NaN/âm để service báo lỗi theo dòng
          const price = parseVNNumber(priceRaw);

          return {
            name: String(name).trim(),
            category: categories,
            unit: String(unit).trim(),
            price: price,
            rowNumber: index + 2
          };
        });
      } else {
        return res.status(400).json({ error: 'Định dạng file không được hỗ trợ. Vui lòng sử dụng file Excel (.xlsx, .xls) hoặc CSV (.csv)' });
      }

      // GỌI SERVICE
      const result = await MedicineService.importMedicines(medicines);

      res.json({
        message: `Import hoàn tất: ${result.success} thành công, ${result.failed} thất bại, ${result.skipped} bỏ qua`,
        success: result.success,
        failed: result.failed,
        skipped: result.skipped,
        errors: result.errors,
        ...result
      });
    } catch (err) {
      console.error('Import error:', err);
      res.status(500).json({ error: err.message || 'Lỗi khi import file' });
    }
  };
  //
}

export default new MedicineController();