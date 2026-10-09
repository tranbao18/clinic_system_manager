import Appointment from '../models/appointment.model.js';
import BaseDAO from './base.dao.js';

// Độ dài 1 khung giờ khám, lấy theo frontend (CalendarLayout.tsx kiểm tra trùng lịch trong vòng 15 phút).
// 2 lịch của cùng bác sĩ cách nhau < 15 phút là trùng.
export const APPOINTMENT_SLOT_MINUTES = 15;

class AppointmentDAO extends BaseDAO {
  async injectDB(conn) {
    return;
  }

  constructor() {
    super(Appointment);
  }

  async findDoctorAppoint(doctor_id) {
    return this.model.find({
      doctor_id,
      disabled: false
    });
  }

  async findPatientAppoint(patient_id) {
    return this.model.find({
      patient_id,
      disabled: false
    });
  }

  // Lịch hẹn đang hoạt động (chưa xóa, chưa hủy) của bác sĩ chồng lên khung giờ bắt đầu tại `date`
  async findDoctorConflict(doctorId, date, excludeId = null) {
    const time = new Date(date).getTime();
    const slotMs = APPOINTMENT_SLOT_MINUTES * 60 * 1000;
    const filter = {
      doctor_id: doctorId,
      disabled: false,
      status: { $ne: 'Cancelled' },
      appointment_date: { $gt: new Date(time - slotMs), $lt: new Date(time + slotMs) },
    };
    if (excludeId) filter._id = { $ne: excludeId };
    return this.model.findOne(filter).sort({ appointment_date: 1 }).lean();
  }
}

export default new AppointmentDAO()
