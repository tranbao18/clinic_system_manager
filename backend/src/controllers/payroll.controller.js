import XLSX from 'xlsx';
import { parse } from 'csv-parse/sync';

import dao from '../dao/payroll.dao.js';
import PayrollImportService from '../services/payroll.service.js';
import pickFields from '../utils/pick-fields.js';
import { parseVNNumber, isBlankCell, MAX_IMPORT_ROWS } from '../utils/import-parse.js';

import errorStatus from '../utils/error-status.js';
const AMOUNT_FIELDS = ['basic_salary', 'bonus', 'deductions'];

// net_salary = lương cơ bản + thưởng - khấu trừ, luôn tính ở server (không tin giá trị client gửi)
function buildPayrollAmounts(input, current = {}) {
  const amounts = {};
  for (const key of AMOUNT_FIELDS) {
    const raw = input[key] !== undefined ? input[key] : current[key];
    const value = raw === undefined || raw === null || raw === '' ? 0 : Number(raw);
    if (!Number.isFinite(value) || value < 0) {
      throw Object.assign(new Error(`Giá trị ${key} không hợp lệ`), { status: 400 });
    }
    amounts[key] = value;
  }
  amounts.net_salary = amounts.basic_salary + amounts.bonus - amounts.deductions;
  if (amounts.net_salary < 0) {
    throw Object.assign(new Error('Lương thực nhận không được âm'), { status: 400 });
  }
  return amounts;
}

class PayrollController {
  async create(req, res) {
    try {
      const data = pickFields(req.body, ['employee_id', 'paydate', ...AMOUNT_FIELDS]);
      Object.assign(data, buildPayrollAmounts(data));

      // Mỗi nhân viên chỉ có một bảng lương/tháng (giống kiểm tra khi import)
      const paydate = new Date(data.paydate);
      if (Number.isNaN(paydate.getTime())) {
        return res.status(400).json({ error: 'Ngày thanh toán không hợp lệ' });
      }
      const month = paydate.getMonth() + 1;
      const year = paydate.getFullYear();
      const existed = await dao.findByEmployeeAndMonth(data.employee_id, month, year);
      if (existed) {
        return res.status(400).json({ error: `Nhân viên đã có bảng lương tháng ${month}/${year}` });
      }

      const result = await dao.create(data);
      res.status(201).json(result);
    } catch (err) {
      res.status(errorStatus(err)).json({ error: err.message });
    }
  };

  async findAll(req, res) {
    try {
      const result = await dao.findAll();
      res.json(result);
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

  // Kế thừa
  async update(req, res) {
    try {
      const { id } = req.params;
      const { sendEmail } = req.query;

      // Cập nhật payroll: chỉ nhận các khoản tiền + ngày trả, net_salary tính lại ở server.
      // Không cho đổi employee_id/emailSent/disabled qua API này.
      const current = await dao.findById(id);
      if (!current) return res.status(404).json({ message: 'Not found' });
      const data = pickFields(req.body, ['paydate', ...AMOUNT_FIELDS]);
      let amounts;
      try {
        amounts = buildPayrollAmounts(data, current);
      } catch (e) {
        return res.status(e.status || 400).json({ error: e.message });
      }
      const result = await dao.update(id, { ...data, ...amounts, updated_at: new Date() });

      // Tự động gửi email nếu sendEmail=true (mặc định là true)
      const shouldSendEmail = sendEmail !== 'false';
      if (shouldSendEmail && result) {
        try {
          // Gửi email với payroll đã cập nhật
          await dao.sendPayrollEmailByPayrollId(id);

          // Lấy lại payroll với emailSent đã cập nhật
          const updatedPayroll = await dao.findById(id);
          const resultObj = updatedPayroll.toObject ? updatedPayroll.toObject() : (updatedPayroll._doc || updatedPayroll);
          return res.json({
            ...resultObj,
            emailSent: true,
            message: "Cập nhật lương thành công và đã gửi email cho nhân viên"
          });
        } catch (emailError) {
          console.error("❌ Lỗi gửi email sau khi cập nhật lương:", emailError);
          const resultObj = result.toObject ? result.toObject() : (result._doc || result);
          return res.json({
            ...resultObj,
            emailSent: false,
            emailError: emailError.message,
            message: "Cập nhật lương thành công nhưng không thể gửi email"
          });
        }
      }

      const resultObj = result.toObject ? result.toObject() : (result._doc || result);
      res.json({
        ...resultObj,
        emailSent: false,
        message: "Cập nhật lương thành công"
      });
    } catch (err) {
      res.status(errorStatus(err)).json({ error: err.message });
    }
  };
  //

  async remove(req, res) {
    try {
      await dao.delete(req.params.id);
      res.json({ message: 'Deleted' });
    } catch (err) {
      res.status(errorStatus(err)).json({ error: err.message });
    }
  };

  async restore(req, res) {
    try {
      await dao.restore(req.params.id);
      res.json({ message: 'Restored' });
    } catch (err) {
      res.status(errorStatus(err)).json({ error: err.message });
    }
  };

  async sendPayrollToEmployee(req, res) {
    try {
      const { employee_id } = req.params;

      const result = await dao.sendMonthlyPayrollEmail(employee_id);

      res.json({
        message: "Gửi mail thành công",
        detail: result,
      });
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  }
  async sendPayrollBulk(req, res) {
    try {
      const { employee_ids } = req.body;

      if (!Array.isArray(employee_ids) || employee_ids.length === 0)
        return res.status(400).json({ message: "Danh sách employee_ids không hợp lệ" });

      const results = await dao.sendBulkMonthlyPayroll(employee_ids);

      res.json({
        message: "Hoàn tất gửi mail bảng lương",
        results,
      });
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  }

  async sendPayrollById(req, res) {
    try {
      const { payroll_id } = req.params;
      const result = await dao.sendPayrollByPayrollId(payroll_id);

      res.json({
        message: "Gửi mail bảng lương thành công",
        detail: result,
      });
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  }
  async sendPayrollBulkById(req, res) {
    try {
      const { payroll_ids } = req.body;

      if (!Array.isArray(payroll_ids) || payroll_ids.length === 0)
        return res.status(400).json({ message: "Danh sách payroll_ids không hợp lệ" });

      const results = await dao.sendBulkPayrollByIds(payroll_ids);

      res.json({
        message: "Hoàn tất gửi email bảng lương",
        results,
      });
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  }

  // Kế thừa
  async import(req, res) {
    try {
      console.log('📥 Payroll import endpoint called');
      console.log('Request file:', req.file ? { name: req.file.originalname, size: req.file.size } : 'No file');

      if (!req.file) {
        return res.status(400).json({ error: 'Không có file được upload' });
      }

      const file = req.file;
      let payrolls = [];

      const normalizeKey = (key = "") =>
        String(key)
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "");
      const buildKeyMap = (row) => {
        const map = {};
        Object.keys(row || {}).forEach((k) => {
          map[normalizeKey(k)] = k;
        });
        return map;
      };

      const getValueByAliases = (row, keyMap, aliases = []) => {
        if (!row) return undefined;
        // 1. Thử khớp chính xác theo normalized key
        for (const alias of aliases) {
          const normAlias = normalizeKey(alias);
          if (keyMap[normAlias] !== undefined) {
            return row[keyMap[normAlias]];
          }
        }
        const keys = Object.keys(keyMap);
        for (const alias of aliases) {
          const normAlias = normalizeKey(alias);
          const foundNormKey = keys.find((k) => k.includes(normAlias));
          if (foundNormKey) {
            return row[keyMap[foundNormKey]];
          }
        }
        return undefined;
      };

      // Dòng trống: không tên, không email và các khoản tiền trống/0
      const isEmptyAmount = (v) => isBlankCell(v) || parseVNNumber(v) === 0;

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

        // Tìm dòng header: có ít nhất cột tên/email + lương
        let headerRowIndex = -1;
        let colIndex = {
          name: -1,
          email: -1,
          basic: -1,
          bonus: -1,
          deductions: -1,
          paydate: -1,
        };

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          if (!Array.isArray(row)) continue;

          // Reset cho mỗi dòng để dòng tiêu đề phía trên (vd "BẢNG LƯƠNG VÀ THƯỞNG") không làm lệch cột
          const current = { name: -1, email: -1, basic: -1, bonus: -1, deductions: -1, paydate: -1 };
          row.forEach((cell, idx) => {
            const norm = normalizeKey(String(cell || ""));
            if (norm.includes("tennhanvien") || norm.includes("hoten")) {
              if (current.name === -1) current.name = idx;
            }
            if (norm.includes("email")) {
              if (current.email === -1) current.email = idx;
            }
            if (norm.includes("luongcoban") || norm === "luong" || norm.includes("salary")) {
              if (current.basic === -1) current.basic = idx;
            }
            if (norm.includes("thuong") || norm.includes("bonus")) {
              if (current.bonus === -1) current.bonus = idx;
            }
            if (norm.includes("khautru") || norm.includes("deduction")) {
              if (current.deductions === -1) current.deductions = idx;
            }
            if (
              norm.includes("ngaythanhtoan") ||
              norm === "ngay" ||
              norm.includes("paydate") ||
              norm === "date"
            ) {
              if (current.paydate === -1) current.paydate = idx;
            }
          });

          if (
            (current.name !== -1 || current.email !== -1) &&
            current.basic !== -1
          ) {
            colIndex = current;
            headerRowIndex = i;
            break;
          }
        }

        if (headerRowIndex === -1) {
          console.error("Không tìm thấy dòng header hợp lệ trong file Excel");
          return res.status(400).json({
            error:
              "Không tìm thấy dòng tiêu đề (header) hợp lệ. Vui lòng kiểm tra lại file Excel theo đúng cấu trúc mẫu.",
          });
        }

        console.log("📄 Payroll import header row index:", headerRowIndex);
        console.log("📄 Payroll column index:", colIndex);

        // Từ dòng sau header trở đi là data
        payrolls = [];
        for (let i = headerRowIndex + 1; i < rows.length; i++) {
          const row = rows[i];
          if (!Array.isArray(row)) continue;

          const employeeName =
            (colIndex.name !== -1 ? row[colIndex.name] : "") || "";
          const employeeEmail =
            (colIndex.email !== -1 ? row[colIndex.email] : "") || "";
          // Giữ nguyên giá trị ô (số tiền dạng "10.000.000", ngày dạng serial Excel...), service parse + báo lỗi theo dòng
          const basicSalaryRaw = colIndex.basic !== -1 ? row[colIndex.basic] : "";
          const bonusRaw = colIndex.bonus !== -1 ? row[colIndex.bonus] : "";
          const deductionsRaw = colIndex.deductions !== -1 ? row[colIndex.deductions] : "";
          const paydateRaw = colIndex.paydate !== -1 ? row[colIndex.paydate] : "";

          // Bỏ qua các dòng trống hoàn toàn
          if (
            !String(employeeName).trim() &&
            !String(employeeEmail).trim() &&
            isEmptyAmount(basicSalaryRaw) &&
            isEmptyAmount(bonusRaw) &&
            isEmptyAmount(deductionsRaw)
          ) {
            continue;
          }

          if (payrolls.length >= MAX_IMPORT_ROWS) {
            return res.status(400).json({ error: `File có hơn ${MAX_IMPORT_ROWS} dòng dữ liệu. Vui lòng chia nhỏ file, tối đa ${MAX_IMPORT_ROWS} dòng mỗi lần import.` });
          }

          payrolls.push({
            employeeName: String(employeeName).trim(),
            employeeEmail: String(employeeEmail).trim(),
            basic_salary: basicSalaryRaw,
            bonus: bonusRaw,
            deductions: deductionsRaw,
            paydate: paydateRaw,
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

        payrolls = records.map((row, index) => {
          const keyMap = buildKeyMap(row);

          const employeeName =
            getValueByAliases(row, keyMap, [
              "Tên nhân viên",
              "Ten nhan vien",
              "Tên",
              "Ten",
              "Họ tên",
              "Ho ten",
              "Employee Name",
              "employee_name",
              "name",
            ]) || "";

          const employeeEmail =
            getValueByAliases(row, keyMap, [
              "Email",
              "Email nhân viên",
              "Email nhan vien",
              "employee_email",
              "email",
            ]) || "";

          const basicSalaryRaw =
            getValueByAliases(row, keyMap, [
              "Lương cơ bản",
              "Luong co ban",
              "Lương",
              "Luong",
              "Basic Salary",
              "basic_salary",
              "Salary",
              "salary",
            ]) ?? "";

          const bonusRaw =
            getValueByAliases(row, keyMap, [
              "Thưởng",
              "Thuong",
              "Bonus",
              "bonus",
            ]) ?? "";

          const deductionsRaw =
            getValueByAliases(row, keyMap, [
              "Khấu trừ",
              "Khau tru",
              "Deductions",
              "deductions",
              "Deduction",
              "deduction",
            ]) ?? "";

          const paydateRaw =
            getValueByAliases(row, keyMap, [
              "Ngày thanh toán",
              "Ngay thanh toan",
              "Ngày",
              "Ngay",
              "Paydate",
              "paydate",
              "Date",
              "date",
            ]) || "";

          // Số tiền và ngày giữ dạng chuỗi gốc, service parse (parseVNNumber/parseFlexibleDate)
          return {
            employeeName: String(employeeName).trim(),
            employeeEmail: String(employeeEmail).trim(),
            basic_salary: basicSalaryRaw,
            bonus: bonusRaw,
            deductions: deductionsRaw,
            paydate: paydateRaw,
            rowNumber: index + 2
          };
        });
      } else {
        return res.status(400).json({ error: 'Định dạng file không được hỗ trợ' });
      }

      if (payrolls.length === 0) {
        return res.status(400).json({ error: 'File không chứa dữ liệu hợp lệ' });
      }

      const result = await PayrollImportService.importPayrolls(payrolls);

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
  }
  //
}

export default new PayrollController();