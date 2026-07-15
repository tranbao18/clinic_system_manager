import UserDAO from '../dao/user.dao.js';
import EmployeeDAO from '../dao/employee.dao.js';
import PatientDAO from '../dao/patient.dao.js';

class UserService {
  async deleteCascade(userId) {
    try {
      await EmployeeDAO.model.updateMany(
        { user_id: userId, disabled: false },
        { disabled: true }
      );

      await PatientDAO.model.updateMany(
        { user_id: userId, disabled: false },
        { disabled: true }
      );

      const result = await UserDAO.delete(userId);
      return result;
    } catch (err) {
      throw err;
    }
  }

  async restoreCascade(userId) {
    try {
      await EmployeeDAO.model.updateMany(
        { user_id: userId, disabled: true },
        { disabled: false }
      );

      await PatientDAO.model.updateMany(
        { user_id: userId, disabled: true },
        { disabled: false }
      );

      const result = await UserDAO.restore(userId);
      return result;
    } catch (err) {
      throw err;
    }
  }
}

export default new UserService();