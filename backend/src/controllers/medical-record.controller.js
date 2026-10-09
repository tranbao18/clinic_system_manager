import dao from '../dao/medical-record.dao.js';
import pickFields from '../utils/pick-fields.js';

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

      // Bác sĩ tạo hồ sơ luôn đứng tên chính mình
      if (req.user?.role === 'Doctor' && req.user.employee_id) {
        payload.doctor_id = req.user.employee_id;
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
      res.status(500).json({ error: err.message });
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
      res.status(500).json({ error: err.message });
    }
  };

  async findById(req, res) {
    try {
      const result = await dao.findById(req.params.id);
      if (!result) return res.status(404).json({ message: 'Not found' });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };

  async update(req, res) {
    try {
      if (!(await loadOwnedRecord(req, res))) return;
      const result = await dao.update(req.params.id, pickFields(req.body, UPDATE_FIELDS));
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
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
      res.status(500).json({ error: err.message });
    }
  };

  async restore(req, res) {
    try {
      await dao.restore(req.params.id);
      res.json({ message: 'Restored' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };

  async findByPatientId(req, res) {
    try {
      const result = await dao.findByPatientId(req.params.id);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };
}

export default new MedicalRecordController();