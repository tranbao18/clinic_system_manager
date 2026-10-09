// Tự code
import dao from '../dao/appointment.dao.js';
import notificationDao from '../dao/notification.dao.js';
import UserDAO from '../dao/user.dao.js';
import EmployeeDAO from '../dao/employee.dao.js';
import Patient from '../models/patient.model.js';
import AppointmentService from '../services/appointment.service.js';
import MedicalRecordDAO from '../dao/medical-record.dao.js';
import InvoiceDAO from '../dao/invoice.dao.js';
import pickFields from '../utils/pick-fields.js';

import errorStatus from '../utils/error-status.js';
const CREATE_FIELDS = ['patient_id', 'doctor_id', 'appointment_date', 'status', 'reason'];
const UPDATE_FIELDS = ['doctor_id', 'appointment_date', 'status', 'reason'];

// Luôn hiển thị theo giờ Việt Nam, không phụ thuộc TZ của server
const formatVNDateTime = (date) => new Date(date).toLocaleString('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
});

const conflictBody = (existing) => ({
  error: `Bác sĩ đã có lịch hẹn lúc ${formatVNDateTime(existing.appointment_date)}. Vui lòng chọn thời gian khác.`
});

async function findActiveEmployee(id) {
  const employee = await EmployeeDAO.model.findById(id).select('fullname disabled').lean();
  return employee && !employee.disabled ? employee : null;
}

// Kế thừa
// Gửi thông báo cho bác sĩ phụ trách và lễ tân. Chạy TRƯỚC khi trả response vì trên serverless
// tiến trình có thể bị dừng ngay sau response; lỗi chỉ ghi log, không làm hỏng request.
async function notifyAppointmentCreated(appointment, patientName) {
  const formattedDate = formatVNDateTime(appointment.appointment_date);
  const name = patientName || 'Bệnh nhân';
  const tasks = [];

  const doctorId = appointment.doctor_id?._id ?? appointment.doctor_id;
  if (doctorId) {
    tasks.push((async () => {
      const doctorUser = await UserDAO.findEmployAcc(String(doctorId));
      if (!doctorUser) {
        console.warn('⚠️ [Appointment] Doctor user not found for employee_id:', String(doctorId));
        return;
      }
      await notificationDao.createForUser(String(doctorUser._id), {
        type: 'appointment_created',
        title: 'Lịch hẹn mới',
        message: `Bạn có lịch hẹn mới với ${name} vào ${formattedDate}`,
        related_id: appointment._id,
        related_type: 'appointment'
      });
    })().catch((err) => console.error('❌ [Appointment] Error creating notification for doctor:', err)));
  }

  tasks.push(
    notificationDao.createForRole('Receptionist', {
      type: 'appointment_created',
      title: 'Lịch hẹn mới',
      message: `Có lịch hẹn mới của ${name} vào ${formattedDate}`,
      related_id: appointment._id,
      related_type: 'appointment'
    }).catch((err) => console.error('❌ [Appointment] Error creating notifications for Receptionists:', err))
  );

  await Promise.all(tasks);
}

class AppointmentController {
  async create(req, res) {
    try {
      const data = pickFields(req.body, CREATE_FIELDS);

      // Bệnh nhân chỉ được đặt lịch cho chính mình, trạng thái luôn là Scheduled
      if (req.user?.role === 'Patient') {
        if (!req.user.patient_id) {
          return res.status(403).json({ error: 'Tài khoản chưa liên kết hồ sơ bệnh nhân' });
        }
        data.patient_id = req.user.patient_id;
        data.status = 'Scheduled';
      }

      const [patient, doctor] = await Promise.all([
        Patient.findById(data.patient_id).select('fullname disabled').lean(),
        findActiveEmployee(data.doctor_id),
      ]);
      if (!patient || patient.disabled) {
        return res.status(400).json({ error: 'Bệnh nhân không tồn tại hoặc đã bị xóa' });
      }
      if (!doctor) {
        return res.status(400).json({ error: 'Bác sĩ không tồn tại hoặc đã bị vô hiệu hóa' });
      }

      // Lịch đã hủy không chiếm khung giờ của bác sĩ
      const occupiesSlot = data.status !== 'Cancelled';
      if (occupiesSlot) {
        const conflict = await dao.findDoctorConflict(data.doctor_id, data.appointment_date);
        if (conflict) return res.status(409).json(conflictBody(conflict));
      }

      const created = await dao.create(data);

      // 2 request đặt cùng khung giờ chạy song song có thể cùng vượt qua bước kiểm tra trên.
      // Kiểm tra lại sau khi ghi: bên nào thấy bên kia thì hủy bản của mình (luôn có ít nhất 1 bên thấy).
      if (occupiesSlot) {
        const raced = await dao.findDoctorConflict(data.doctor_id, data.appointment_date, created._id);
        if (raced) {
          await dao.hardDelete(created._id);
          return res.status(409).json(conflictBody(raced));
        }
      }

      let result = created;
      try {
        const populated = await dao.model
          .findById(created._id)
          .populate("patient_id", "fullname")
          .populate("doctor_id", "fullname position")
          .exec();
        if (populated) result = populated;
      } catch (e) {
        console.warn("Could not populate appointment after create:", e.message || e);
      }

      await notifyAppointmentCreated(result, patient.fullname);

      res.status(201).json(result);
    } catch (err) {
      res.status(errorStatus(err)).json({ error: err.message });
    }
  };

  async findAll(req, res) {
    try {
      // Mặc định chỉ trả lịch hẹn chưa xóa; xem lịch đã xóa (thùng rác) chỉ dành cho Admin
      const showDeleted = req.query.disabled === 'true';
      if (showDeleted && req.user?.role !== 'Admin') {
        return res.status(403).json({ error: 'Chỉ Admin được xem lịch hẹn đã xóa' });
      }
      const filter = { disabled: showDeleted };
      try {
        const result = await dao.model.find(filter)
          .populate('patient_id', 'fullname')
          .populate('doctor_id', 'fullname position')
          .exec();
        return res.json(result);
      } catch (e) {
        console.warn('Không thể lấy ra appointments trong findAll:', e.message || e);
        const result = await dao.findAll(filter);
        return res.json(result);
      }
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

  async findByDocId(req, res) {
    try {
      const result = await dao.findDoctorAppoint(req.params.id);
      if (!result) return res.status(404).json({ message: 'Not found' });
      res.json(result);
    } catch (err) {
      res.status(errorStatus(err)).json({ error: err.message });
    }
  };

  async findByPatientId(req, res) {
    try {
      // Bệnh nhân chỉ xem được lịch hẹn của chính mình
      if (req.user?.role === 'Patient' && String(req.user.patient_id) !== String(req.params.id)) {
        return res.status(403).json({ error: 'Không có quyền xem lịch hẹn của bệnh nhân khác' });
      }
      const result = await dao.findPatientAppoint(req.params.id);
      if (!result) return res.status(404).json({ message: 'Not found' });
      res.json(result);
    } catch (err) {
      res.status(errorStatus(err)).json({ error: err.message });
    }
  };

  async update(req, res) {
    try {
      const data = pickFields(req.body, UPDATE_FIELDS);

      // Đổi bác sĩ/giờ khám (hoặc mở lại lịch đã hủy) thì phải kiểm tra trùng lịch của bác sĩ
      const mayConflict = data.doctor_id !== undefined || data.appointment_date !== undefined ||
        (data.status !== undefined && data.status !== 'Cancelled');
      if (mayConflict) {
        const current = await dao.model.findById(req.params.id).exec();
        if (!current) return res.status(404).json({ error: 'Appointment not found' });

        const doctorChanged = data.doctor_id !== undefined && String(data.doctor_id) !== String(current.doctor_id);
        const dateChanged = data.appointment_date !== undefined &&
          new Date(data.appointment_date).getTime() !== new Date(current.appointment_date).getTime();
        const status = data.status ?? current.status;
        const reopened = current.status === 'Cancelled' && status !== 'Cancelled';

        if (doctorChanged && !(await findActiveEmployee(data.doctor_id))) {
          return res.status(400).json({ error: 'Bác sĩ không tồn tại hoặc đã bị vô hiệu hóa' });
        }

        const doctorId = data.doctor_id ?? current.doctor_id;
        const date = data.appointment_date ?? current.appointment_date;
        if ((doctorChanged || dateChanged || reopened) && status !== 'Cancelled' && !current.disabled && doctorId && date) {
          const conflict = await dao.findDoctorConflict(doctorId, date, current._id);
          if (conflict) return res.status(409).json(conflictBody(conflict));
        }
      }

      const result = await dao.update(req.params.id, data);
      if (!result) return res.status(404).json({ error: 'Appointment not found' });
      res.json(result);
    } catch (err) {
      res.status(errorStatus(err)).json({ error: err.message });
    }
  };

  // Kế thừa
  async remove(req, res) {
    try {
      const isAdmin = req.user?.role === 'Admin';
      // Chỉ Admin được xóa vĩnh viễn; vai trò khác gửi hard=true sẽ được xóa mềm
      const hard = isAdmin && req.query && req.query.hard === 'true';

      const appointmentRaw = await dao.model.findById(req.params.id).exec();
      if (!appointmentRaw) {
        return res.status(404).json({ error: 'Appointment not found' });
      }

      if (hard) {
        // Không xóa vĩnh viễn lịch hẹn đã có bệnh án/hóa đơn (kể cả đã xóa mềm) để tránh dữ liệu mồ côi
        const [hasRecord, hasInvoice] = await Promise.all([
          MedicalRecordDAO.model.exists({ appointment_id: appointmentRaw._id }),
          InvoiceDAO.model.exists({ appointment_id: appointmentRaw._id }),
        ]);
        if (hasRecord || hasInvoice) {
          return res.status(400).json({ error: 'Lịch hẹn đã có bệnh án hoặc hóa đơn, không thể xóa vĩnh viễn' });
        }
        await dao.hardDelete(req.params.id);
        return res.json({ message: 'Appointment hard deleted (permanent)' });
      }

      if (appointmentRaw.disabled) {
        return res.json({ message: 'Appointment already deleted' });
      }

      if (appointmentRaw.status === 'Completed') {
        return res.status(400).json({ error: 'Completed appointment cannot be deleted' });
      }

      // Người không phải Admin không được xóa lịch hẹn đã có bệnh án/hóa đơn đang hoạt động
      if (!isAdmin) {
        const [hasRecord, hasInvoice] = await Promise.all([
          MedicalRecordDAO.model.exists({ appointment_id: appointmentRaw._id, disabled: false }),
          InvoiceDAO.model.exists({ appointment_id: appointmentRaw._id, disabled: false }),
        ]);
        if (hasRecord || hasInvoice) {
          return res.status(400).json({ error: 'Lịch hẹn đã có bệnh án hoặc hóa đơn, chỉ Admin được xóa' });
        }
      }

      await AppointmentService.deleteCascade(req.params.id);
      res.json({ message: 'Appointment deleted with cascade' });
    } catch (err) {
      res.status(errorStatus(err)).json({ error: err.message });
    }
  };
  //

  async restore(req, res) {
    try {
      await AppointmentService.restoreCascade(req.params.id);
      res.json({ message: 'Appointment restore with cascade' });
    } catch (err) {
      res.status(errorStatus(err)).json({ error: err.message });
    }
  };

}

export default new AppointmentController();