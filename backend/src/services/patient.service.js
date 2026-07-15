import PatientDAO from '../dao/patient.dao.js';
import AppointmentDAO from '../dao/appointment.dao.js';
import MedicalRecordDAO from '../dao/medical-record.dao.js';
import UserDAO from '../dao/user.dao.js';
import InvoiceDAO from '../dao/invoice.dao.js';

class PatientService {
  async deleteCascade(patientId, hard = false) {
    try {
      if (hard) {
        await AppointmentDAO.model.deleteMany({ patient_id: patientId });
        await MedicalRecordDAO.model.deleteMany({ patient_id: patientId });
        await UserDAO.model.deleteMany({ patient_id: patientId });

        const result = await PatientDAO.hardDelete(patientId);
        return result;
      }

      // ===== SOFT DELETE =====
      await AppointmentDAO.model.updateMany(
        { patient_id: patientId, disabled: false },
        { disabled: true }
      );

      await MedicalRecordDAO.model.updateMany(
        { patient_id: patientId, disabled: false },
        { disabled: true }
      );

      await UserDAO.model.updateMany(
        { patient_id: patientId, disabled: false },
        { disabled: true }
      );

      await InvoiceDAO.model.updateMany(
        { patient_id: patientId, disabled: false },
        { disabled: true }
      );

      const result = await PatientDAO.delete(patientId);
      return result;
    } catch (err) {
      throw err;
    }
  }

  async restoreCascade(patientId) {
    try {
      await AppointmentDAO.model.updateMany(
        { patient_id: patientId, disabled: true },
        { disabled: false }
      );

      await MedicalRecordDAO.model.updateMany(
        { patient_id: patientId, disabled: true },
        { disabled: false }
      );

      await UserDAO.model.updateMany(
        { patient_id: patientId, disabled: true },
        { disabled: false }
      );

      await InvoiceDAO.model.updateMany(
        { patient_id: patientId, disabled: true },
        { disabled: false }
      );

      const result = await PatientDAO.restore(patientId);
      return result;
    } catch (err) {
      throw err;
    }
  }
}

export default new PatientService();