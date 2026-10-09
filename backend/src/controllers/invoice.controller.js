import dao from '../dao/invoice.dao.js';
import medicalRecordDao from '../dao/medical-record.dao.js';
import notificationDao from '../dao/notification.dao.js';
import Payment from '../models/payment.model.js';
import InvoiceService from '../services/invoice.service.js';
import pickFields from '../utils/pick-fields.js';
import withDocLock from '../utils/doc-lock.js';
import Appointment from '../models/appointment.model.js';
import { aggregatePrescriptions, deductForPrescriptions, releaseDeductions } from '../services/inventory.service.js';

// Trạng thái hóa đơn luôn suy ra từ tổng tiền đã thanh toán, không tin giá trị client gửi
async function computeInvoiceStatus(invoiceId, totalAmount) {
  const payments = await Payment.find({ invoice_id: invoiceId, disabled: false });
  const totalPaid = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  if (totalPaid >= totalAmount) return 'Paid';
  if (totalPaid > 0) return 'Partial';
  return 'Unpaid';
}

class InvoiceController {

  async create(req, res) {
    try {
      // Hóa đơn mới luôn ở trạng thái Unpaid; không nhận status/disabled từ client
      const result = await dao.create(pickFields(req.body, ['patient_id', 'appointment_id', 'total_amount']));
      res.status(201).json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };

  // Kế thừa
  async createFromMedicalRecord(req, res) {
    try {
      const { medicalRecordId } = req.params;

      // Lấy medical record với đầy đủ thông tin
      const medicalRecord = await medicalRecordDao.model
        .findOne({ _id: medicalRecordId, disabled: false })
        .populate('patient_id')
        .populate('appointment_id')
        .populate('prescriptions.medicine_id', 'name unit price')
        .exec();

      if (!medicalRecord) {
        return res.status(404).json({ error: 'Hồ sơ y tế không tồn tại' });
      }
      if (!medicalRecord.appointment_id) {
        return res.status(400).json({
          error: 'Hồ sơ y tế phải có lịch hẹn để tạo hóa đơn. Vui lòng liên kết hồ sơ với lịch hẹn trước.'
        });
      }
      if (!medicalRecord.prescriptions || medicalRecord.prescriptions.length === 0) {
        return res.status(400).json({
          error: 'Hồ sơ y tế phải có toa thuốc để tạo hóa đơn'
        });
      }

      // Toa thuốc phải hợp lệ: thuốc tồn tại, số lượng nguyên dương, có giá
      const invalid = [];
      for (const p of medicalRecord.prescriptions) {
        const medicine = p.medicine_id;
        const qty = Number(p.quantity);
        if (!medicine || !medicine._id) invalid.push('có thuốc không còn tồn tại');
        else if (!Number.isInteger(qty) || qty <= 0) invalid.push(`${medicine.name}: số lượng không hợp lệ`);
        else if (!(Number(medicine.price) > 0)) invalid.push(`${medicine.name}: chưa có giá`);
      }
      if (invalid.length > 0) {
        return res.status(400).json({ error: `Toa thuốc không hợp lệ: ${invalid.join('; ')}` });
      }

      // Tổng tiền tính từ giá thuốc trong DB
      const totalAmount = medicalRecord.prescriptions.reduce(
        (sum, p) => sum + Number(p.medicine_id.price) * Number(p.quantity),
        0
      );

      const appointmentId = medicalRecord.appointment_id._id || medicalRecord.appointment_id;
      const patientId = medicalRecord.patient_id?._id || medicalRecord.patient_id;

      // Khóa theo lịch hẹn: bấm 2 lần / 2 người cùng tạo sẽ không sinh 2 hóa đơn và không trừ kho 2 lần
      const result = await withDocLock(Appointment, appointmentId, async () => {
        const existingInvoice = await dao.model.findOne({
          appointment_id: appointmentId,
          disabled: false
        });
        if (existingInvoice) {
          throw Object.assign(new Error('Hóa đơn đã tồn tại cho lịch hẹn này'), {
            status: 400,
            invoice_id: existingInvoice._id
          });
        }

        // Thiếu thuốc còn hạn -> báo lỗi, không tạo hóa đơn, không trừ gì
        const deductions = await deductForPrescriptions(aggregatePrescriptions(medicalRecord.prescriptions));
        try {
          return await dao.create({
            patient_id: patientId,
            appointment_id: appointmentId,
            total_amount: totalAmount,
            status: 'Unpaid',
            stock_deductions: deductions
          });
        } catch (err) {
          await releaseDeductions(deductions);
          throw err;
        }
      });

      const populatedInvoice = await dao.model
        .findById(result._id)
        .populate('patient_id')
        .populate('appointment_id')
        .exec();

      try {
        const patientName = populatedInvoice.patient_id?.fullname || 'Bệnh nhân';
        const amount = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(populatedInvoice.total_amount);

        await notificationDao.createForRole('Accountant', {
          type: 'invoice_created',
          title: 'Hóa đơn mới',
          message: `Hóa đơn mới cho ${patientName} với tổng tiền ${amount}. Vui lòng xử lý thanh toán.`,
          related_id: populatedInvoice._id,
          related_type: 'invoice'
        });

        // Thông báo cho Admin
        await notificationDao.createForRole('Admin', {
          type: 'invoice_created',
          title: 'Hóa đơn mới',
          message: `Hóa đơn mới cho ${patientName} với tổng tiền ${amount}.`,
          related_id: populatedInvoice._id,
          related_type: 'invoice'
        });
      } catch (notifErr) {
        console.error('Error creating notification for invoice:', notifErr);
      }

      res.status(201).json(populatedInvoice);
    } catch (err) {
      return res.status(err.status || 500).json({
        error: err.message,
        ...(err.invoice_id && { invoice_id: err.invoice_id }),
        ...(err.shortages && { shortages: err.shortages })
      });
    }
  };
  //

  async findAll(req, res) {
    try {
      const filter = {};
      if (req.query.disabled !== undefined) {
        if (!req.user || req.user.role !== 'Admin') {
          return res.status(403).json({ error: 'Không có quyền xem mục Thùng rác' });
        }
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
      const invoice = await dao.model.findById(req.params.id);
      if (!invoice) return res.status(404).json({ message: 'Not found' });

      // Chỉ cho sửa tổng tiền; status được tính lại từ các khoản thanh toán
      const data = {};
      if (req.body?.total_amount !== undefined) {
        const total = Number(req.body.total_amount);
        if (!Number.isFinite(total) || total < 0) {
          return res.status(400).json({ error: 'Tổng tiền không hợp lệ' });
        }
        data.total_amount = total;
      }
      data.status = await computeInvoiceStatus(invoice._id, data.total_amount ?? invoice.total_amount);
      data.updated_at = new Date();

      const result = await dao.update(req.params.id, data);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };

  async remove(req, res) {
    try {
      await InvoiceService.deleteCascade(req.params.id);
      res.json({ message: 'Deleted with cascade' });
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  };

  async restore(req, res) {
    try {
      await InvoiceService.restoreCascade(req.params.id);
      res.json({ message: 'Invoice restore with cascade' });
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  };

  async findByPatientId(req, res) {
    try {
      const result = await dao.findByPatientId(req.params.id);
      res.json(Array.isArray(result) ? result : []);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };
}

export default new InvoiceController();