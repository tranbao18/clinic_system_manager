import XLSX from 'xlsx';
import { parse } from 'csv-parse/sync';

import dao from '../dao/medicine-import.dao.js';
import Medicine from '../models/medicine.model.js';
import MedicineImport from '../models/medicine-import.model.js';
import Employee from '../models/employee.model.js';
import MedicineImportService from '../services/medicine-import.service.js';
import pickFields from '../utils/pick-fields.js';
import {
  parseVNNumber,
  parseFlexibleDate,
  normalizeHeaderKey,
  exactMatchRegex,
  isBlankCell,
  MAX_IMPORT_ROWS,
} from '../utils/import-parse.js';

const tooManyRowsError = (count) =>
  `File có hơn ${MAX_IMPORT_ROWS} dòng dữ liệu${count ? ` (${count} dòng)` : ''}. Vui lòng chia nhỏ file, tối đa ${MAX_IMPORT_ROWS} dòng mỗi lần import.`;

// remaining luôn = quantity khi tạo (DAO tự gán); không cho client tự đặt tồn kho
const CREATE_FIELDS = ['medicine_id', 'supplier', 'batchcode', 'quantity', 'unit_price', 'expiry_date', 'import_date', 'imported_by'];
// Không cho sửa quantity/remaining/medicine_id qua PUT (điều chỉnh tồn kho dùng chức năng cập nhật số lượng)
const UPDATE_FIELDS = ['supplier', 'batchcode', 'unit_price', 'expiry_date', 'import_date'];

class MedicineImportController {
  async create(req, res) {
    try {
      const result = await dao.create(pickFields(req.body, CREATE_FIELDS));
      res.status(201).json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };

  async findAll(req, res) {
    try {
      const filter = {};
      if (req.query.disabled !== undefined) {
        filter.disabled = req.query.disabled === 'true';
      }
      const result = await dao.findAll(filter);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };

  async findById(req, res) {
    try {
      const result = await dao.findById(req.params.id);
      if (!result) return res.status(404).json({ message: 'Not found' });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };

  async update(req, res) {
    try {
      const result = await dao.update(req.params.id, pickFields(req.body, UPDATE_FIELDS));
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };

  async remove(req, res) {
    try {
      await dao.delete(req.params.id);
      res.json({ message: 'Deleted' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };

  async restore(req, res) {
    try {
      await dao.restore(req.params.id);
      res.json({ message: 'Restored' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };

  // Kế thừa
  async import(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Không có file được upload' });
      }

      const file = req.file;
      let imports = [];

      // Chuẩn hóa key header: bỏ dấu tiếng Việt (kể cả "đ"), khoảng trắng, ký tự đặc biệt
      const normalizeKey = normalizeHeaderKey;

      // Hàm chuẩn hóa tên để so sánh (bỏ dấu, lowercase, trim)
      const normalizeName = (str = "") =>
        String(str)
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .trim();

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

        // Tìm dòng header: có ít nhất cột tên thuốc + nhà cung cấp + mã lô + số lượng + giá nhập
        let headerRowIndex = -1;
        let fallbackHeaderIndex = -1; // Dòng đầu tiên có dữ liệu để làm fallback
        let colIndex = {
          medicineName: -1,
          supplier: -1,
          batchcode: -1,
          quantity: -1,
          unitPrice: -1,
          expiryDate: -1,
          importDate: -1,
          importerName: -1,
          // Các cột để tạo medicine mới nếu chưa có
          category: -1,
          unit: -1,
          price: -1, // giá bán
        };

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          if (!Array.isArray(row)) continue;

          // Tìm dòng đầu tiên có dữ liệu để làm fallback
          const hasAnyValue = row.some((cell) => String(cell || "").trim() !== "");
          if (hasAnyValue && fallbackHeaderIndex === -1) {
            fallbackHeaderIndex = i;
          }

          // Reset colIndex cho mỗi dòng để tránh tích lũy từ dòng trước
          const currentColIndex = {
            medicineName: -1,
            supplier: -1,
            batchcode: -1,
            quantity: -1,
            unitPrice: -1,
            expiryDate: -1,
            importDate: -1,
            importerName: -1,
            category: -1,
            unit: -1,
            price: -1,
          };

          row.forEach((cell, idx) => {
            const norm = normalizeKey(String(cell || ""));
            // Tên thuốc - ưu tiên "tenthuoc", "thuoc", "medicine", tránh match với "soluong"
            if ((norm.includes("tenthuoc") || norm.includes("thuoc") || norm === "medicine" || (norm === "name" && !norm.includes("soluong"))) && currentColIndex.medicineName === -1) {
              currentColIndex.medicineName = idx;
            }
            // Nhà cung cấp - chỉ match chính xác
            if ((norm.includes("nhacungcap") || norm === "supplier") && currentColIndex.supplier === -1) {
              currentColIndex.supplier = idx;
            }
            // Mã lô - chỉ match chính xác
            if ((norm.includes("malo") || norm === "batchcode") && currentColIndex.batchcode === -1) {
              currentColIndex.batchcode = idx;
            }
            // Số lượng - chỉ match chính xác, KHÔNG match với "name" hoặc "tenthuoc"
            if ((norm.includes("soluong") || norm === "quantity") &&
              currentColIndex.quantity === -1 &&
              !norm.includes("name") &&
              !norm.includes("tenthuoc") &&
              !norm.includes("thuoc")) {
              currentColIndex.quantity = idx;
            }
            // Giá nhập - tránh nhầm với giá bán
            if ((norm.includes("gianhap") || norm === "unitprice" || norm === "importprice") &&
              !norm.includes("giaban") &&
              currentColIndex.unitPrice === -1) {
              currentColIndex.unitPrice = idx;
            }
            // Hạn sử dụng
            if ((norm.includes("hansudung") || norm === "expirydate") && currentColIndex.expiryDate === -1) {
              currentColIndex.expiryDate = idx;
            }
            // Ngày nhập
            if ((norm.includes("ngaynhap") || norm === "importdate") && currentColIndex.importDate === -1) {
              currentColIndex.importDate = idx;
            }
            // Người nhập
            if ((norm.includes("nguoinhap") || norm === "importer" || norm === "importedby") && currentColIndex.importerName === -1) {
              currentColIndex.importerName = idx;
            }
            // Các cột để tạo medicine mới
            if ((norm.includes("danhmuc") || norm === "category") && currentColIndex.category === -1) {
              currentColIndex.category = idx;
            }
            if ((norm.includes("donvi") || norm === "unit") && currentColIndex.unit === -1) {
              currentColIndex.unit = idx;
            }
            // Giá bán - tránh nhầm với giá nhập
            if ((norm.includes("giaban") || (norm === "price" && !norm.includes("gianhap"))) && currentColIndex.price === -1) {
              currentColIndex.price = idx;
            }
          });

          // Kiểm tra các cột không được trùng nhau (trừ các cột optional)
          const requiredCols = [
            currentColIndex.medicineName,
            currentColIndex.supplier,
            currentColIndex.batchcode,
            currentColIndex.quantity,
            currentColIndex.unitPrice,
            currentColIndex.expiryDate,
            currentColIndex.importDate,
            currentColIndex.importerName
          ];
          const hasDuplicates = requiredCols.some((val, idx) =>
            val !== -1 && requiredCols.indexOf(val) !== idx
          );

          // Xác nhận header hợp lệ nếu có ít nhất các cột bắt buộc và không trùng nhau
          if (
            currentColIndex.medicineName !== -1 &&
            currentColIndex.supplier !== -1 &&
            currentColIndex.batchcode !== -1 &&
            currentColIndex.quantity !== -1 &&
            currentColIndex.unitPrice !== -1 &&
            currentColIndex.expiryDate !== -1 &&
            currentColIndex.importDate !== -1 &&
            currentColIndex.importerName !== -1 &&
            !hasDuplicates
          ) {
            colIndex = currentColIndex;
            headerRowIndex = i;
            break;
          }
        }

        // Nếu không tìm được header theo tên cột, dùng fallback với mapping mặc định
        if (headerRowIndex === -1) {
          if (fallbackHeaderIndex !== -1) {
            headerRowIndex = fallbackHeaderIndex;
            // Mapping mặc định theo thứ tự cột thông thường:
            // 0: Tên thuốc, 1: Danh mục, 2: Đơn vị, 3: Giá bán, 4: Nhà cung cấp, 5: Mã lô, 6: Số lượng, 7: Giá nhập, 8: Hạn sử dụng, 9: Ngày nhập, 10: Người nhập
            colIndex = {
              medicineName: 0,
              category: 1,
              unit: 2,
              price: 3,
              supplier: 4,
              batchcode: 5,
              quantity: 6,
              unitPrice: 7,
              expiryDate: 8,
              importDate: 9,
              importerName: 10,
            };
            console.warn("⚠️ Không nhận diện được header theo tên cột, dùng fallback header tại dòng", headerRowIndex, "với mapping mặc định");
          } else {
            console.error("Không tìm thấy dòng header hợp lệ trong file Excel");
            return res.status(400).json({
              error:
                "Không tìm thấy dòng tiêu đề (header) hợp lệ. Vui lòng kiểm tra lại file Excel theo đúng cấu trúc mẫu.",
            });
          }
        }

        console.log("📄 Medicine Import header row index:", headerRowIndex);
        console.log("📄 Medicine Import column index:", colIndex);

        // Từ dòng sau header trở đi là data
        imports = [];
        for (let i = headerRowIndex + 1; i < rows.length; i++) {
          const row = rows[i];
          if (!Array.isArray(row)) continue;

          const medicineName = (colIndex.medicineName !== -1 ? row[colIndex.medicineName] : "") || "";
          const supplier = (colIndex.supplier !== -1 ? row[colIndex.supplier] : "") || "";
          const batchcode = (colIndex.batchcode !== -1 ? row[colIndex.batchcode] : "") || "";
          const importerName = (colIndex.importerName !== -1 ? row[colIndex.importerName] : "") || "";
          // Giữ nguyên giá trị ô số/ngày (có thể là serial Excel) để service parse và báo lỗi theo dòng
          const quantityRaw = colIndex.quantity !== -1 ? row[colIndex.quantity] : "";
          const unitPriceRaw = colIndex.unitPrice !== -1 ? row[colIndex.unitPrice] : "";
          const expiryDateRaw = colIndex.expiryDate !== -1 ? row[colIndex.expiryDate] : "";
          const importDateRaw = colIndex.importDate !== -1 ? row[colIndex.importDate] : "";

          // Các cột để tạo medicine mới nếu chưa có
          const categoryStr = (colIndex.category !== -1 ? row[colIndex.category] : "") || "";
          const unit = (colIndex.unit !== -1 ? row[colIndex.unit] : "") || "";
          const priceRaw = colIndex.price !== -1 ? row[colIndex.price] : "";

          // Xử lý danh mục (có thể là string phân cách bằng dấu phẩy)
          const categories = categoryStr
            ? String(categoryStr).split(',').map(cat => cat.trim()).filter(Boolean)
            : [];

          // Bỏ qua các dòng trống hoàn toàn
          const normMedicineName = normalizeName(medicineName);
          if (!normMedicineName && !String(supplier).trim() && !String(batchcode).trim() &&
            isBlankCell(quantityRaw) && isBlankCell(unitPriceRaw)) {
            continue;
          }

          // Bỏ qua nếu đây thực chất là dòng header bị lọt vào
          if (normMedicineName === normalizeName("Tên thuốc") || normMedicineName === normalizeName("Thuốc")) {
            continue;
          }

          if (imports.length >= MAX_IMPORT_ROWS) {
            return res.status(400).json({ error: tooManyRowsError() });
          }

          imports.push({
            medicineName: String(medicineName).trim(),
            supplier: String(supplier).trim(),
            batchcode: String(batchcode).trim(),
            quantity: quantityRaw,
            unit_price: unitPriceRaw,
            expiry_date: expiryDateRaw,
            import_date: importDateRaw,
            importerName: String(importerName).trim(),
            // Thông tin để tạo medicine mới
            category: categories,
            unit: String(unit).trim(),
            price: priceRaw,
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
          return res.status(400).json({ error: tooManyRowsError(dataCount) });
        }

        imports = records.map((row, index) => {
          const medicineName = row['Tên thuốc'] || row['Thuốc'] || row['Medicine'] || row['medicine'] || '';
          const supplier = row['Nhà cung cấp'] || row['Supplier'] || row['supplier'] || '';
          const batchcode = row['Mã lô'] || row['Batchcode'] || row['batchcode'] || '';
          const quantity = row['Số lượng'] || row['Quantity'] || row['quantity'] || '';

          // Thông tin để tạo medicine nếu chưa có
          const categoryStr = row['Danh mục'] || row['Category'] || row['category'] || '';
          const unit = row['Đơn vị'] || row['Unit'] || row['unit'] || '';

          // Tìm giá bán (khác với giá nhập)
          let priceRaw = '';
          const priceKeys = ['Giá bán', 'Giá', 'Price', 'price', 'Gia ban', 'gia ban'];
          for (const key of priceKeys) {
            if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
              priceRaw = row[key];
              break;
            }
          }

          // Xử lý danh mục (có thể là string phân cách bằng dấu phẩy)
          const categories = categoryStr
            ? categoryStr.split(',').map(cat => cat.trim()).filter(Boolean)
            : [];

          // Tìm giá nhập với nhiều tên cột có thể (ưu tiên "Giá nhập", tránh nhầm với "Giá bán")
          let unitPriceRaw = '';
          const importPriceKeys = ['Giá nhập', 'Gia nhap', 'Unit Price', 'unit_price', 'Import Price', 'import_price'];
          for (const key of importPriceKeys) {
            if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
              unitPriceRaw = row[key];
              break;
            }
          }

          // Nếu không tìm thấy, tìm trong tất cả keys có chứa "giá nhập" hoặc "import price"
          if (!unitPriceRaw) {
            const allKeys = Object.keys(row);
            const priceKey = allKeys.find(key => {
              const lowerKey = key.toLowerCase();
              return (lowerKey.includes('giá nhập') || lowerKey.includes('gia nhap') ||
                lowerKey.includes('import price') || lowerKey.includes('unit price')) &&
                !lowerKey.includes('giá bán') && !lowerKey.includes('gia ban');
            });
            if (priceKey) {
              unitPriceRaw = row[priceKey];
            }
          }

          const expiryDateRaw = row['Hạn sử dụng'] || row['Expiry Date'] || row['expiry_date'] || '';
          const importDateRaw = row['Ngày nhập'] || row['Import Date'] || row['import_date'] || '';
          const importerName = row['Người nhập'] || row['Importer'] || row['imported_by'] || '';

          // Số và ngày giữ dạng chuỗi gốc, service parse (parseVNNumber/parseFlexibleDate)
          return {
            medicineName: String(medicineName).trim(),
            supplier: String(supplier).trim(),
            batchcode: String(batchcode).trim(),
            quantity,
            unit_price: unitPriceRaw,
            expiry_date: expiryDateRaw,
            import_date: importDateRaw,
            importerName: String(importerName).trim(),
            // Thông tin để tạo medicine
            category: categories,
            unit: String(unit).trim(),
            price: priceRaw,
            rowNumber: index + 2
          };
        });
      } else {
        return res.status(400).json({ error: 'Định dạng file không được hỗ trợ. Vui lòng sử dụng file Excel (.xlsx, .xls) hoặc CSV (.csv)' });
      }

      const result = await MedicineImportService.importWithTransaction({
        imports,
        user: req.user
      });

      res.json({
        message: `Import hoàn tất: ${result.success} thành công, ${result.failed} thất bại, ${result.skipped} bỏ qua`,
        success: result.success,
        failed: result.failed,
        skipped: result.skipped,
        errors: result.errors
      });
    } catch (err) {
      console.error('Import error:', err);
      res.status(500).json({ error: err.message || 'Lỗi khi import file' });
    }
  };

  /**
   * Nhập thêm tồn kho từ file: mỗi dòng tạo một lô (medicine import) mới.
   * File hỗ trợ: Excel (.xlsx, .xls) hoặc CSV (.csv)
   * Cột bắt buộc: medicine_id hoặc Tên thuốc, Mã lô, Số lượng, Giá nhập, Hạn sử dụng.
   * Lô đã tồn tại (cùng thuốc + mã lô, chưa bị xóa) sẽ bị bỏ qua → upload lại cùng file không nhân đôi tồn kho.
   */
  async updateQuantities(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Không có file được upload' });
      }

      const file = req.file;
      const parsedRows = [];

      const normalizeKey = normalizeHeaderKey;

      const normalizeName = (str = "") =>
        String(str)
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .toLowerCase()
          .trim();

      // Read Excel
      if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.mimetype === 'application/vnd.ms-excel') {
        const workbook = XLSX.read(file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
        if (!Array.isArray(rows) || rows.length === 0) {
          return res.status(400).json({ error: 'File không chứa dữ liệu hợp lệ' });
        }

        let headerRowIndex = -1;
        let fallbackHeaderIndex = -1;
        let colIndex = {
          medicineId: -1,
          medicineName: -1,
          category: -1,
          unit: -1,
          price: -1,
          supplier: -1,
          batchcode: -1,
          quantity: -1,
          unitPrice: -1,
          expiryDate: -1,
          importDate: -1,
          importerName: -1,
        };

        const expectedHeaderTokens = [
          "tenthuoc", "thuoc", "name", "medicine",
          "nhacungcap", "supplier",
          "malo", "batchcode",
          "soluong", "quantity", "qty",
          "gianhap", "unitprice", "importprice",
          "hansudung", "expirydate", "expiry_date",
          "ngaynhap", "importdate", "import_date",
          "nguoinhap", "importer", "importedby",
          "medicineid", "medicine_id", "id"
        ];

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          if (!Array.isArray(row)) continue;
          const hasAnyValue = row.some((cell) => String(cell || "").trim() !== "");
          if (hasAnyValue && fallbackHeaderIndex === -1) fallbackHeaderIndex = i;

          const current = { ...colIndex };
          const normKeysInRow = [];
          row.forEach((cell, idx) => {
            const norm = normalizeKey(String(cell || ""));
            if (norm) normKeysInRow.push(norm);
            if ((norm.includes("medicineid") || norm.includes("medicine_id") || norm === "id") && current.medicineId === -1) current.medicineId = idx;
            if ((norm.includes("tenthuoc") || norm.includes("thuoc") || norm === "medicine" || (norm === "name" && !norm.includes("soluong"))) && current.medicineName === -1) current.medicineName = idx;
            if ((norm.includes("danhmuc") || norm === "category") && current.category === -1) current.category = idx;
            if ((norm.includes("donvi") || norm === "unit") && current.unit === -1) current.unit = idx;
            if ((norm.includes("giaban") || (norm === "price" && !norm.includes("gianhap"))) && current.price === -1) current.price = idx;
            if ((norm.includes("nhacungcap") || norm === "supplier") && current.supplier === -1) current.supplier = idx;
            if ((norm.includes("malo") || norm === "batchcode") && current.batchcode === -1) current.batchcode = idx;
            if ((norm.includes("soluong") || norm === "quantity") && current.quantity === -1 && !norm.includes("name") && !norm.includes("tenthuoc") && !norm.includes("thuoc")) current.quantity = idx;
            if ((norm.includes("gianhap") || norm === "unitprice" || norm === "importprice") && current.unitPrice === -1) current.unitPrice = idx;
            if ((norm.includes("hansudung") || norm === "expirydate") && current.expiryDate === -1) current.expiryDate = idx;
            if ((norm.includes("ngaynhap") || norm === "importdate") && current.importDate === -1) current.importDate = idx;
            if ((norm.includes("nguoinhap") || norm === "importer" || norm === "importedby") && current.importerName === -1) current.importerName = idx;
          });

          // Skip rows that look like a title (e.g., "DANH SÁCH NHẬP SỐ LƯỢNG THUỐC")
          if (normKeysInRow.length === 1 && normKeysInRow[0].includes("danhsach")) {
            continue;
          }

          const matchCount = normKeysInRow.reduce((c, k) => c + (expectedHeaderTokens.some(t => k.includes(t)) ? 1 : 0), 0);
          if (matchCount === 0) {
            continue;
          }

          const nextRow = rows[i + 1];
          const nextNextRow = rows[i + 2];
          const countNonEmpty = (r) =>
            Array.isArray(r) ? r.reduce((cnt, cell) => cnt + (String(cell || "").trim() !== "" ? 1 : 0), 0) : 0;
          const nextNonEmpty = countNonEmpty(nextRow);
          const nextNextNonEmpty = countNonEmpty(nextNextRow);

          // count header-like tokens on next row
          const nextNormKeys = Array.isArray(nextRow) ? nextRow.map(c => normalizeKey(String(c || ""))) : [];
          const nextMatchCount = nextNormKeys.reduce((c, k) => c + (expectedHeaderTokens.some(t => k.includes(t)) ? 1 : 0), 0);

          if (matchCount >= 2) {
            // fairly confident this is header
            colIndex = current;
            headerRowIndex = i;
            break;
          }

          // if next row looks like header tokens (e.g., title row above actual header), skip current
          if (nextMatchCount >= 2) {
            continue;
          }

          // if next row looks like data (has several non-empty cells), accept current as header
          if (nextNonEmpty > 0 && nextNextNonEmpty >= 0) {
            colIndex = current;
            headerRowIndex = i;
            break;
          }

          const requiredCols = [
            current.supplier,
            current.batchcode,
            current.quantity,
            current.unitPrice,
            current.expiryDate,
            current.importDate,
            current.importerName
          ];
          const hasDuplicates = requiredCols.some((val, idx) => val !== -1 && requiredCols.indexOf(val) !== idx);
          if ((current.medicineId !== -1 || current.medicineName !== -1) && !hasDuplicates) {
            colIndex = current;
            headerRowIndex = i;
            break;
          }
        }

        if (headerRowIndex === -1) {
          if (fallbackHeaderIndex !== -1) {
            headerRowIndex = fallbackHeaderIndex;
            colIndex = {
              medicineId: -1,
              medicineName: 0,
              category: 1,
              unit: 2,
              price: 3,
              supplier: 4,
              batchcode: 5,
              quantity: 6,
              unitPrice: 7,
              expiryDate: 8,
              importDate: 9,
              importerName: 10,
            };
          } else {
            return res.status(400).json({ error: 'Không tìm thấy dòng tiêu đề (header) hợp lệ.' });
          }
        }
        // Build headerMap from header row to support flexible column positions (handles extra ID column)
        const headerRow = Array.isArray(rows[headerRowIndex]) ? rows[headerRowIndex] : [];
        const headerMap = {};
        headerRow.forEach((cell, idx) => {
          const k = normalizeKey(String(cell || ""));
          if (k) headerMap[k] = idx;
        });
        console.log("updateQuantities: detected headerRowIndex=", headerRowIndex, "headerRow=", headerRow);
        console.log("updateQuantities: initial colIndex detected=", colIndex);
        console.log("updateQuantities: headerMap keys=", Object.keys(headerMap));

        // If some important columns not detected in colIndex, try to fill from headerMap
        const tryKeys = (candidates) => {
          for (const k of candidates) {
            if (headerMap[k] !== undefined) return headerMap[k];
          }
          return -1;
        };
        if (colIndex.medicineId === -1) colIndex.medicineId = tryKeys(["medicineid", "medicine_id", "id", "medicine"]);
        if (colIndex.medicineName === -1) colIndex.medicineName = tryKeys(["tenthuoc", "thuoc", "medicine", "name"]);
        if (colIndex.supplier === -1) colIndex.supplier = tryKeys(["nhacungcap", "supplier"]);
        if (colIndex.batchcode === -1) colIndex.batchcode = tryKeys(["malo", "batchcode"]);
        if (colIndex.quantity === -1) colIndex.quantity = tryKeys(["soluong", "quantity", "qty"]);
        if (colIndex.unitPrice === -1) colIndex.unitPrice = tryKeys(["gianhap", "unitprice", "importprice"]);
        if (colIndex.expiryDate === -1) colIndex.expiryDate = tryKeys(["hansudung", "expirydate", "expiry_date"]);
        if (colIndex.importDate === -1) colIndex.importDate = tryKeys(["ngaynhap", "importdate", "import_date"]);
        if (colIndex.importerName === -1) colIndex.importerName = tryKeys(["nguoinhap", "importer", "importedby"]);

        for (let i = headerRowIndex + 1; i < rows.length; i++) {
          const row = rows[i];
          if (!Array.isArray(row)) continue;
          const medicineId = colIndex.medicineId !== -1 ? String(row[colIndex.medicineId] || "").trim() : "";
          const medicineName = colIndex.medicineName !== -1 ? String(row[colIndex.medicineName] || "").trim() : "";
          const supplier = colIndex.supplier !== -1 ? String(row[colIndex.supplier] || "").trim() : "";
          const batchcode = colIndex.batchcode !== -1 ? String(row[colIndex.batchcode] || "").trim() : "";
          // Giữ nguyên giá trị ô số/ngày (có thể là serial Excel), parse + validate ở bước xử lý bên dưới
          const quantityRaw = colIndex.quantity !== -1 ? row[colIndex.quantity] : "";
          const unitPriceRaw = colIndex.unitPrice !== -1 ? row[colIndex.unitPrice] : "";
          const expiryDateRaw = colIndex.expiryDate !== -1 ? row[colIndex.expiryDate] : "";
          const importDateRaw = colIndex.importDate !== -1 ? row[colIndex.importDate] : "";
          const importerName = colIndex.importerName !== -1 ? String(row[colIndex.importerName] || "").trim() : "";

          if (!medicineId && !medicineName && !supplier && !batchcode && isBlankCell(quantityRaw) && isBlankCell(unitPriceRaw)) {
            continue;
          }

          // skip possible header rows
          const normMedicineName = normalizeName(medicineName);
          if (normMedicineName && (normMedicineName === normalizeName("Tên thuốc") || normMedicineName === normalizeName("Thuốc"))) {
            continue;
          }

          if (parsedRows.length >= MAX_IMPORT_ROWS) {
            return res.status(400).json({ error: tooManyRowsError() });
          }

          parsedRows.push({
            medicine_id: medicineId,
            medicineName,
            supplier,
            batchcode,
            quantity: quantityRaw,
            unit_price: unitPriceRaw,
            expiry_date: expiryDateRaw,
            import_date: importDateRaw,
            importerName,
            rowNumber: i + 1
          });
        }
      }
      // CSV
      else if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
        const records = parse(file.buffer.toString('utf-8'), {
          columns: true,
          skip_empty_lines: true,
          trim: true
        });

        for (let i = 0; i < records.length; i++) {
          const row = records[i];
          const keys = Object.keys(row);
          const findKey = (cands) => keys.find(k => cands.some(c => normalizeKey(k).includes(c)));
          const medicineIdKey = findKey(["medicineid", "medicine_id", "id", "medicine"]);
          const nameKey = findKey(["tenthuoc", "thuoc", "medicine", "name"]);
          const supplierKey = findKey(["nhacungcap", "supplier"]);
          const batchKey = findKey(["malo", "batchcode"]);
          const qtyKey = findKey(["soluong", "quantity", "qty"]);
          const unitPriceKey = findKey(["gianhap", "unitprice", "importprice"]);
          const expiryKey = findKey(["hansudung", "expirydate", "expiry_date"]);
          const importDateKey = findKey(["ngaynhap", "importdate", "import_date"]);
          const importerKey = findKey(["nguoinhap", "importer", "importedby"]);

          const medicineId = medicineIdKey ? String(row[medicineIdKey] || "").trim() : "";
          const medicineName = nameKey ? String(row[nameKey] || "").trim() : "";
          const supplier = supplierKey ? String(row[supplierKey] || "").trim() : "";
          const batchcode = batchKey ? String(row[batchKey] || "").trim() : "";
          const quantity = qtyKey ? row[qtyKey] : "";
          const unit_price = unitPriceKey ? row[unitPriceKey] : "";
          const expiry_date = expiryKey ? row[expiryKey] : "";
          const import_date = importDateKey ? row[importDateKey] : "";
          const importerName = importerKey ? String(row[importerKey] || "").trim() : "";

          if (!medicineId && !medicineName && !supplier && !batchcode && isBlankCell(quantity) && isBlankCell(unit_price)) continue;
          if (parsedRows.length >= MAX_IMPORT_ROWS) {
            return res.status(400).json({ error: tooManyRowsError() });
          }
          parsedRows.push({
            medicine_id: medicineId,
            medicineName,
            supplier,
            batchcode,
            quantity,
            unit_price,
            expiry_date,
            import_date,
            importerName,
            rowNumber: i + 2
          });
        }
      } else {
        return res.status(400).json({ error: 'Định dạng file không được hỗ trợ. Vui lòng sử dụng file Excel (.xlsx, .xls) hoặc CSV (.csv)' });
      }

      // Mỗi dòng hợp lệ tạo một lô mới; dòng thiếu/sai dữ liệu báo lỗi, lô đã tồn tại thì bỏ qua
      const results = { success: 0, failed: 0, skipped: 0, errors: [] };
      const oidRegex = /^[a-fA-F0-9]{24}$/;
      for (let idx = 0; idx < parsedRows.length; idx++) {
        const importData = parsedRows[idx];
        const rowNum = importData.rowNumber || idx + 1;
        try {
          // Must have medicine_id or medicineName
          if (!importData.medicine_id && !importData.medicineName) {
            throw new Error(`Thiếu medicine_id hoặc Tên thuốc (dòng ${rowNum})`);
          }

          const quantity = parseVNNumber(importData.quantity);
          if (!Number.isInteger(quantity) || quantity <= 0) {
            throw new Error(`Số lượng phải là số nguyên > 0, nhận được "${importData.quantity ?? ''}" (dòng ${rowNum})`);
          }

          const batchcode = String(importData.batchcode || "").trim();
          if (!batchcode) {
            throw new Error(`Mã lô không được để trống (dòng ${rowNum})`);
          }

          // Giá nhập dùng cho giá trị tồn kho, không lấy giá bán của thuốc thay thế
          const unit_price = parseVNNumber(importData.unit_price);
          if (!Number.isFinite(unit_price) || unit_price <= 0) {
            throw new Error(`Giá nhập phải > 0, nhận được "${importData.unit_price ?? ''}" (dòng ${rowNum})`);
          }

          if (isBlankCell(importData.expiry_date)) {
            throw new Error(`Hạn sử dụng không được để trống (dòng ${rowNum})`);
          }
          const expiryDate = parseFlexibleDate(importData.expiry_date);
          if (!expiryDate) {
            throw new Error(`Hạn sử dụng không hợp lệ "${importData.expiry_date}", dùng dd/mm/yyyy hoặc yyyy-mm-dd (dòng ${rowNum})`);
          }

          let importDate = new Date();
          if (!isBlankCell(importData.import_date)) {
            importDate = parseFlexibleDate(importData.import_date);
            if (!importDate) {
              throw new Error(`Ngày nhập không hợp lệ "${importData.import_date}", dùng dd/mm/yyyy hoặc yyyy-mm-dd (dòng ${rowNum})`);
            }
          }

          // Resolve medicine: prefer medicine_id if valid ObjectId; otherwise find by name (bỏ qua thuốc đã xóa)
          let medicine = null;
          if (importData.medicine_id && oidRegex.test(String(importData.medicine_id))) {
            medicine = await Medicine.findOne({ _id: String(importData.medicine_id), disabled: false });
            if (!medicine) {
              throw new Error(`Không tìm thấy medicine với id ${importData.medicine_id} (dòng ${rowNum})`);
            }
          } else if (importData.medicineName) {
            medicine = await Medicine.findOne({
              name: exactMatchRegex(importData.medicineName),
              disabled: false
            }).sort({ created_at: 1, _id: 1 });
            if (!medicine) {
              throw new Error(`Không tìm thấy thuốc với tên "${importData.medicineName}" (dòng ${rowNum}). Vui lòng cung cấp medicine_id hoặc tạo thuốc trước.`);
            }
          } else {
            throw new Error(`medicine_id "${importData.medicine_id}" không hợp lệ (dòng ${rowNum})`);
          }

          // Lô đã có (cùng thuốc + mã lô) → bỏ qua để upload lại cùng file không cộng trùng tồn kho
          const existed = await MedicineImport.findOne({
            medicine_id: medicine._id,
            batchcode: exactMatchRegex(batchcode),
            disabled: false
          });
          if (existed) {
            results.skipped++;
            results.errors.push({
              row: rowNum,
              medicine: importData.medicineName || importData.medicine_id,
              error: `Lô "${batchcode}" của thuốc này đã tồn tại, bỏ qua để tránh cộng trùng tồn kho (dòng ${rowNum})`,
              type: 'skipped'
            });
            continue;
          }

          const supplier = String(importData.supplier || "").trim() || "Bulk update";
          const importedBy = (importData.importerName ? (await Employee.findOne({ fullname: importData.importerName })) : null)?._id || req.user?.employee_id || null;

          await dao.create({
            medicine_id: medicine._id,
            supplier,
            batchcode,
            quantity,
            remaining: quantity,
            unit_price,
            expiry_date: expiryDate,
            import_date: importDate,
            imported_by: importedBy
          });

          results.success++;
        } catch (err) {
          results.failed++;
          results.errors.push({ row: rowNum, medicine: importData.medicineName || importData.medicine_id, error: err.message || String(err), type: 'failed' });
        }
      }

      return res.json({ message: 'Cập nhật số lượng hoàn tất', results });
    } catch (err) {
      console.error('updateQuantities error:', err);
      res.status(500).json({ error: err.message || 'Lỗi khi xử lý file update-quantities' });
    }
  };
  //
}

export default new MedicineImportController();