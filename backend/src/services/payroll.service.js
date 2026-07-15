import EmployeeDAO from '../dao/employee.dao.js';
import PayrollDAO from '../dao/payroll.dao.js';

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
        // 1️⃣ Tìm employee
        let employee = null;

        if (payroll.employeeEmail) {
          employee = await EmployeeDAO.findByEmail(payroll.employeeEmail);
        }

        if (!employee && payroll.employeeName) {
          employee = await EmployeeDAO.findByName(payroll.employeeName);
        }

        if (!employee) {
          throw new Error(`Không tìm thấy nhân viên`);
        }

        // 2️⃣ Validate lương
        if (payroll.basic_salary <= 0) {
          throw new Error('Lương cơ bản phải lớn hơn 0');
        }

        if (payroll.net_salary < 0) {
          throw new Error('Lương thực nhận không được âm');
        }

        // 3️⃣ Kiểm tra payroll trùng tháng
        const paydate = new Date(payroll.paydate);
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
            name: payroll.employeeName || payroll.employeeEmail,
            error: `Đã có bảng lương tháng ${month}/${year}`,
            type: 'skipped'
          });
          continue;
        }

        // 4️⃣ Tạo payroll
        await PayrollDAO.create({
          employee_id: employee._id,
          basic_salary: payroll.basic_salary,
          bonus: payroll.bonus,
          deductions: payroll.deductions,
          net_salary: payroll.net_salary,
          paydate: payroll.paydate
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