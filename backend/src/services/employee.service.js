import EmployeeDAO from '../dao/employee.dao.js';
import UserDAO from '../dao/user.dao.js';
import AppointmentDAO from '../dao/appointment.dao.js';
import PayrollDAO from '../dao/payroll.dao.js';
import MedicalRecordDAO from '../dao/medical-record.dao.js';

class EmployeeService {
  async deleteCascade(employeeId, hard = false) {
    try {
      if (hard) {
        await AppointmentDAO.model.deleteMany(
          { doctor_id: employeeId }
        );

        await UserDAO.model.deleteMany(
          { employee_id: employeeId }
        );

        await PayrollDAO.model.deleteMany(
          { employee_id: employeeId }
        );

        await MedicalRecordDAO.model.deleteMany(
          { doctor_id: employeeId }
        );

        const result = await EmployeeDAO.hardDelete(employeeId);
        return result;
      }

      // ===== SOFT DELETE =====
      await AppointmentDAO.model.updateMany(
        { doctor_id: employeeId, disabled: false },
        { disabled: true }
      );

      await UserDAO.model.updateMany(
        { employee_id: employeeId, disabled: false },
        { disabled: true }
      );

      await PayrollDAO.model.updateMany(
        { employee_id: employeeId, disabled: false },
        { disabled: true }
      );

      await MedicalRecordDAO.model.updateMany(
        { doctor_id: employeeId, disabled: false },
        { disabled: true }
      );

      const result = await EmployeeDAO.delete(employeeId);
      return result;
    } catch (err) {
      throw err;
    }
  }

  async restoreCascade(employeeId) {
    try {
      await AppointmentDAO.model.updateMany(
        { doctor_id: employeeId, disabled: true },
        { disabled: false }
      );

      await UserDAO.model.updateMany(
        { employee_id: employeeId, disabled: true },
        { disabled: false }
      );

      await PayrollDAO.model.updateMany(
        { employee_id: employeeId, disabled: true },
        { disabled: false }
      );

      await MedicalRecordDAO.model.updateMany(
        { doctor_id: employeeId, disabled: true },
        { disabled: false }
      );

      const result = await EmployeeDAO.restore(employeeId);
      return result;
    } catch (err) {
      throw err;
    }
  }
}

export default new EmployeeService();