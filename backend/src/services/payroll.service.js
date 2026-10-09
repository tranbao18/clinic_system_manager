import EmployeeDAO from '../dao/employee.dao.js';
import PayrollDAO from '../dao/payroll.dao.js';
import { parseVNNumber, parseFlexibleDate, isBlankCell } from '../utils/import-parse.js';

// Số tiền từ file: trống → 0; sai định dạng hoặc âm → lỗi dòng
function parseAmount(raw, label) {
  const value = parseVNNumber(raw);
  if (value === null) return 0;
  if (Number.isNaN(value)) throw new Error(`${label} không hợp lệ: "${raw}"`);
  if (value < 0) throw new Error(`${label} không được âm`);
  return value;
}

class PayrollImportService {
  static async importPayrolls(payrolls = []) {
    const results = {
      success: 0,
      failed: 0,
      skipped: 0,
      errors: []
    };

    for (const payroll of payrolls) {
      try {
        // 1️⃣ Tìm employee: ưu tiên email, sau đó khớp nguyên họ tên (không khớp một phần)
        const email = String(payroll.employeeEmail ?? '').trim();
        const name = String(payroll.employeeName ?? '').trim();
        let employee = null;

        if (email) {
          employee = await EmployeeDAO.findByEmail(email);
        }

        if (!employee && name) {
          const matches = await EmployeeDAO.findByExactName(name);
          if (matches.length > 1) {
            throw new Error(`Có nhiều nhân viên trùng tên "${name}", cần nhập email để xác định`);
          }
          employee = matches[0] || null;
        }

        if (!employee) {
          const who = [email && `email "${email}"`, name && `tên "${name}"`].filter(Boolean).join(' hoặc ');
          throw new Error(who ? `Không tìm thấy nhân viên với ${who}` : 'Thiếu tên hoặc email nhân viên');
        }

        // 2️⃣ Parse + validate lương
        const basic_salary = parseAmount(payroll.basic_salary, 'Lương cơ bản');
        const bonus = parseAmount(payroll.bonus, 'Thưởng');
        const deductions = parseAmount(payroll.deductions, 'Khấu trừ');
        const net_salary = basic_salary + bonus - deductions;

        if (basic_salary <= 0) {
          throw new Error('Lương cơ bản phải lớn hơn 0');
        }

        if (net_salary < 0) {
          throw new Error('Lương thực nhận không được âm');
        }

        // Ngày thanh toán: trống → hôm nay; có giá trị nhưng sai định dạng → lỗi
        let paydate = new Date();
        if (!isBlankCell(payroll.paydate)) {
          paydate = parseFlexibleDate(payroll.paydate);
          if (!paydate) {
            throw new Error(`Ngày thanh toán không hợp lệ "${payroll.paydate}", dùng dd/mm/yyyy hoặc yyyy-mm-dd`);
          }
        }

        // 3️⃣ Kiểm tra payroll trùng tháng
        const month = paydate.getMonth() + 1;
        const year = paydate.getFullYear();

        const existed = await PayrollDAO.findByEmployeeAndMonth(
          employee._id,
          month,
          year
        );

        if (existed) {
          results.skipped++;
          results.errors.push({
            row: payroll.rowNumber,
            name: name || email,
            error: `Đã có bảng lương tháng ${month}/${year}`,
            type: 'skipped'
          });
          continue;
        }

        // 4️⃣ Tạo payroll
        await PayrollDAO.create({
          employee_id: employee._id,
          basic_salary,
          bonus,
          deductions,
          net_salary,
          paydate
        });

        results.success++;

      } catch (err) {
        results.failed++;
        results.errors.push({
          row: payroll.rowNumber,
          name: payroll.employeeName || payroll.employeeEmail,
          error: err.message,
          type: 'failed'
        });
      }
    }

    return results;
  }
}

export default PayrollImportService;
