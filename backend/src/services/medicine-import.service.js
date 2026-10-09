import Medicine from '../models/medicine.model.js';
import MedicineImport from '../models/medicine-import.model.js';
import Employee from '../models/employee.model.js';
import dao from '../dao/medicine-import.dao.js';
import { parseVNNumber, parseFlexibleDate, exactMatchRegex, isBlankCell } from '../utils/import-parse.js';

const lowerTrim = (s = '') => String(s ?? '').trim().toLowerCase();

class MedicineImportService {
  static async importWithTransaction({ imports, user }) {
    const results = {
      success: 0,
      failed: 0,
      skipped: 0,
      errors: []
    };

    // Khóa lô = thuốc + nhà cung cấp + mã lô (một lô mới cùng nhà cung cấp vẫn được nhập)
    const seenInFile = new Set();

    for (const importData of imports) {
      const row = importData.rowNumber;
      const skip = (reason) => {
        results.skipped++;
        results.errors.push({ row, medicine: importData.medicineName, error: reason, type: 'skipped' });
      };

      try {
        // ========= VALIDATE (trước khi ghi bất cứ gì vào DB) =========
        const medicineName = String(importData.medicineName ?? '').trim();
        const supplier = String(importData.supplier ?? '').trim();
        const batchcode = String(importData.batchcode ?? '').trim();
        if (!medicineName) throw new Error(`Tên thuốc không được để trống (dòng ${row})`);
        if (!supplier) throw new Error(`Nhà cung cấp không được để trống (dòng ${row})`);
        if (!batchcode) throw new Error(`Mã lô không được để trống (dòng ${row})`);

        const quantity = parseVNNumber(importData.quantity);
        if (!Number.isInteger(quantity) || quantity <= 0) {
          throw new Error(`Số lượng phải là số nguyên > 0, nhận được "${importData.quantity ?? ''}" (dòng ${row})`);
        }
        const unitPrice = parseVNNumber(importData.unit_price);
        if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
          throw new Error(`Giá nhập phải > 0, nhận được "${importData.unit_price ?? ''}" (dòng ${row})`);
        }

        if (isBlankCell(importData.expiry_date)) throw new Error(`Hạn sử dụng không được để trống (dòng ${row})`);
        const expiryDate = parseFlexibleDate(importData.expiry_date);
        if (!expiryDate) {
          throw new Error(`Hạn sử dụng không hợp lệ "${importData.expiry_date}", dùng dd/mm/yyyy hoặc yyyy-mm-dd (dòng ${row})`);
        }
        let importDate = new Date();
        if (!isBlankCell(importData.import_date)) {
          importDate = parseFlexibleDate(importData.import_date);
          if (!importDate) {
            throw new Error(`Ngày nhập không hợp lệ "${importData.import_date}", dùng dd/mm/yyyy hoặc yyyy-mm-dd (dòng ${row})`);
          }
        }

        // ========= DUPLICATE TRONG FILE =========
        const key = `${lowerTrim(medicineName)}|${lowerTrim(supplier)}|${lowerTrim(batchcode)}`;
        if (seenInFile.has(key)) {
          skip(`Trùng lô trong file (cùng thuốc, nhà cung cấp, mã lô "${batchcode}") (dòng ${row})`);
          continue;
        }

        // ========= FIND MEDICINE (khớp nguyên tên, lấy bản cũ nhất nếu DB có trùng) =========
        let medicine = await Medicine.findOne({ name: exactMatchRegex(medicineName), disabled: false })
          .sort({ created_at: 1, _id: 1 });

        let newMedicineData = null;
        if (!medicine) {
          const price = parseVNNumber(importData.price);
          const unit = String(importData.unit ?? '').trim();
          if (!unit || !Number.isFinite(price) || price <= 0) {
            throw new Error(`Thuốc "${medicineName}" chưa có trong hệ thống, cần Đơn vị và Giá bán > 0 để tạo mới (dòng ${row})`);
          }
          newMedicineData = {
            name: medicineName,
            category: importData.category || [],
            unit,
            price,
            disabled: false
          };
        }

        // ========= FIND EMPLOYEE =========
        let importedBy = user?.employee_id || null;
        if (importData.importerName) {
          const emp = await Employee.findOne({
            fullname: importData.importerName
          });

          if (!emp) {
            throw new Error(`Không tìm thấy người nhập "${importData.importerName}" (dòng ${row})`);
          }
          importedBy = emp._id;
        }

        // ========= DUPLICATE TRONG DB =========
        if (medicine) {
          const existed = await MedicineImport.findOne({
            medicine_id: medicine._id,
            supplier: exactMatchRegex(supplier),
            batchcode: exactMatchRegex(batchcode),
            disabled: false
          });

          if (existed) {
            skip(`Lô "${batchcode}" của nhà cung cấp "${supplier}" đã tồn tại trong hệ thống (dòng ${row})`);
            continue;
          }
        }

        // ========= CREATE (chỉ tạo thuốc mới khi dòng đã hợp lệ) =========
        let createdMedicine = null;
        if (newMedicineData) {
          createdMedicine = await Medicine.create(newMedicineData);
          medicine = createdMedicine;
        }

        try {
          await dao.create({
            medicine_id: medicine._id,
            supplier,
            batchcode,
            quantity,
            remaining: quantity,
            unit_price: unitPrice,
            expiry_date: expiryDate,
            import_date: importDate,
            imported_by: importedBy
          });
        } catch (err) {
          // Không để lại thuốc mồ côi nếu tạo lô thất bại
          if (createdMedicine) {
            await Medicine.deleteOne({ _id: createdMedicine._id }).catch(() => {});
          }
          throw err;
        }

        seenInFile.add(key);
        results.success++;
      } catch (err) {
        results.failed++;
        results.errors.push({
          row,
          medicine: importData.medicineName,
          error: err.message,
          type: 'failed'
        });
      }
    }

    return results;
  }
}

export default MedicineImportService;
