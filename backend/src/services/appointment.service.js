import AppointmentDAO from '../dao/appointment.dao.js';
import MedicalRecordDAO from '../dao/medical-record.dao.js';
import InvoiceDAO from '../dao/invoice.dao.js';

class AppointmentService {
  async deleteCascade(appointmentId) {
    try {
      const appointment = await AppointmentDAO.findById(appointmentId);

      if (!appointment) {
        throw new Error('Appointment not found');
      }

      if (appointment.status === 'Completed') {
        throw new Error('Completed appointment cannot be deleted');
      }

      await MedicalRecordDAO.model.updateMany(
        { appointment_id: appointmentId, disabled: false },
        { disabled: true }
      );

      await InvoiceDAO.model.updateMany(
        { appointment_id: appointmentId, disabled: false },
        { disabled: true }
      );

      const result = await AppointmentDAO.delete(appointmentId);
      return result;
    } catch (err) {
      throw err;
    }
  }

  async restoreCascade(appointmentId) {
    try {
      const appointment = await AppointmentDAO.findById(appointmentId);

      if (!appointment) {
        throw new Error('Appointment not found');
      }

      if (appointment.status === 'Completed') {
        throw new Error('Completed appointment cannot be restored');
      }

      await MedicalRecordDAO.model.updateMany(
        { appointment_id: appointmentId, disabled: true },
        { disabled: false }
      );

      await InvoiceDAO.model.updateMany(
        { appointment_id: appointmentId, disabled: true },
        { disabled: false }
      );

      const result = await AppointmentDAO.restore(appointmentId);
      return result;
    } catch (err) {
      throw err;
    }
  }
}

export default new AppointmentService();