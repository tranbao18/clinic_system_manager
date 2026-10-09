import dao from '../dao/medical-record.dao.js';
import AppointmentDAO from '../dao/appointment.dao.js';
import EmployeeDAO from '../dao/employee.dao.js';
import pickFields from '../utils/pick-fields.js';
import Invoice from '../models/invoice.model.js';
import Patient from '../models/patient.model.js';

import errorStatus from '../utils/error-status.js';
// So sánh toa thuốc theo (thuốc, số lượng); đổi liều dùng không ảnh hưởng kho/tiền
const prescriptionKey = (list = []) =>
  list.map((p) => `${String(p.medicine_id?._id || p.medicine_id)}:${Number(p.quantity)}`).sort().join('|');

const CREATE_FIELDS = ['appointment_id', 'patient_id', 'doctor_id', 'diagnosis', 'treatment', 'notes', 'prescriptions'];
// Không cho đổi patient_id/doctor_id/appointment_id khi sửa (tránh gán hồ sơ sang bệnh nhân/bác sĩ khác)
const UPDATE_FIELDS = ['diagnosis', 'treatment', 'notes', 'prescriptions'];

// Bác sĩ chỉ được sửa/xóa hồ sơ do chính mình phụ trách; Admin được thao tác mọi hồ sơ
async function loadOwnedRecord(req, res) {
  const record = await dao.model.findById(req.params.id).exec();
  if (!record) {
    res.status(404).json({ error: 'Không tìm thấy hồ sơ' });
    return null;
  }
  if (req.user?.role !== 'Admin' && String(record.doctor_id) !== String(req.user?.employee_id)) {
    res.status(403).json({ error: 'Chỉ bác sĩ phụ trách hoặc Admin được thao tác hồ sơ này' });
    return null;
  }
  return record;
}

class MedicalRecordController {
  async create(req, res) {
    try {
      const payload = pickFields(req.body, CREATE_FIELDS);
      if (!payload.appointment_id) delete payload.appointment_id;
      if (!payload.doctor_id) delete payload.doctor_id;

      // Bác sĩ tạo hồ sơ luôn đứng tên chính mình
      const isDoctor = req.user?.role === 'Doctor' && Boolean(req.user.employee_id);
      if (isDoctor) {
        payload.doctor_id = req.user.employee_id;
      }

      const patient = await Patient.findById(payload.patient_id).select('disabled').lean();
      if (!patient || patient.disabled) {
        return res.status(400).json({ error: 'Bệnh nhân không tồn tại hoặc đã bị xóa' });
      }

      let doctorFromAppointment = false;
      if (payload.appointment_id) {
        const appointment = await AppointmentDAO.model.findById(payload.appointment_id)
          .select('patient_id doctor_id status disabled').lean();
        if (!appointment || appointment.disabled || appointment.status === 'Cancelled') {
          return res.status(400).json({ error: 'Lịch hẹn không tồn tại, đã bị xóa hoặc đã hủy' });
        }
        if (String(appointment.patient_id) !== String(payload.patient_id)) {
          return res.status(400).json({ error: 'Lịch hẹn không thuộc bệnh nhân này' });
        }
        // Người tạo không phải bác sĩ (vd Admin): frontend gửi doctor_id là _id của User, không phải Employee
        // -> lấy bác sĩ phụ trách từ lịch hẹn
        if (!isDoctor && appointment.doctor_id) {
          payload.doctor_id = String(appointment.doctor_id);
          doctorFromAppointment = true;
        }
      }

      // doctor_id do client gửi (không lấy được từ token/lịch hẹn) phải là nhân viên còn hoạt động,
      // nếu không populate('doctor_id') trả null và các trang hiển thị bị lỗi
      if (!isDoctor && !doctorFromAppointment) {
        const doctor = payload.doctor_id
          ? await EmployeeDAO.model.findById(payload.doctor_id).select('disabled').lean()
          : null;
        if (!doctor || doctor.disabled) {
          return res.status(400).json({ error: 'Bác sĩ phụ trách không hợp lệ. Vui lòng chọn lịch hẹn hoặc bác sĩ hợp lệ.' });
        }
      }

      // Nếu có appointment_id thì không cho phép tạo trùng hồ sơ cho cùng một lịch hẹn
      if (payload.appointment_id) {
        const existing = await dao.model.findOne({
          appointment_id: payload.appointment_id,
          disabled: false,
        });

        if (existing) {
          return res.status(400).json({
            error: 'Hồ sơ y tế cho lịch hẹn này đã tồn tại. Vui lòng sử dụng hồ sơ hiện có hoặc chọn lịch hẹn khác.',
            existing_record_id: existing._id,
          });
        }
      }

      const result = await dao.create(payload);
      res.status(201).json(result);
    } catch (err) {
      res.status(errorStatus(err)).json({ error: err.message });
    }
  };

  async findAll(req, res) {
    try {
      const filter = {};
      if (req.query.disabled !== undefined) {
        filter.disabled = req.query.disabled === 'true';
      }
      const result = await dao.findAll(filter);
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

  async update(req, res) {
    try {
      const record = await loadOwnedRecord(req, res);
      if (!record) return;
      const data = pickFields(req.body, UPDATE_FIELDS);

      // Đã có hóa đơn (kho đã trừ theo toa cũ) thì không cho đổi thuốc/số lượng
      if (data.prescriptions && prescriptionKey(data.prescriptions) !== prescriptionKey(record.prescriptions)) {
        const invoiced = record.appointment_id &&
          (await Invoice.exists({ appointment_id: record.appointment_id, disabled: false }));
        if (invoiced) {
          return res.status(400).json({ error: 'Hồ sơ đã có hóa đơn. Hãy xóa hóa đơn trước khi sửa thuốc hoặc số lượng trong toa.' });
        }
      }

      const result = await dao.update(req.params.id, data);
      res.json(result);
    } catch (err) {
      res.status(errorStatus(err)).json({ error: err.message });
    }
  };

  async remove(req, res) {
    try {
      if (!(await loadOwnedRecord(req, res))) return;
      // Chỉ Admin được xóa vĩnh viễn
      if (req.query && req.query.hard === 'true') {
        if (req.user?.role !== 'Admin') {
          return res.status(403).json({ error: 'Chỉ Admin được xóa vĩnh viễn hồ sơ' });
        }
        await dao.hardDelete(req.params.id);
        return res.json({ message: 'Permanently deleted' });
      }
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

  async findByPatientId(req, res) {
    try {
      const result = await dao.findByPatientId(req.params.id);
      res.json(result);
    } catch (err) {
      res.status(errorStatus(err)).json({ error: err.message });
    }
  };
}

export default new MedicalRecordController();