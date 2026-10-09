import InvoiceDAO from '../dao/invoice.dao.js';
import PaymentDAO from '../dao/payment.dao.js';
import Appointment from '../models/appointment.model.js';
import withDocLock from '../utils/doc-lock.js';
import { releaseDeductions, reapplyDeductions } from './inventory.service.js';

const httpError = (status, message) => Object.assign(new Error(message), { status });

class InvoiceService {
  async deleteCascade(invoiceId) {
    try {
      const invoice = await InvoiceDAO.model.findById(invoiceId);
      if (!invoice) throw httpError(404, 'Hóa đơn không tồn tại');
      if (invoice.disabled) return invoice;

      // Đánh dấu nguyên tử để chỉ hoàn kho đúng 1 lần (kể cả khi bấm xóa 2 lần cùng lúc)
      const claimed = await InvoiceDAO.model
        .findOneAndUpdate(
          { _id: invoiceId, stock_restored: { $ne: true } },
          { $set: { stock_restored: true } }
        )
        .select('+stock_deductions');
      if (claimed?.stock_deductions?.length) {
        await releaseDeductions(claimed.stock_deductions);
      }

      await PaymentDAO.model.updateMany(
        { invoice_id: invoiceId, disabled: false },
        { disabled: true, disabled_by_cascade: true }
      );

      const result = await InvoiceDAO.delete(invoiceId);
      return result;
    } catch (err) {
      throw err;
    }
  }

  async restoreCascade(invoiceId) {
    try {
      const invoice = await InvoiceDAO.model.findById(invoiceId).select('+stock_deductions');
      if (!invoice) throw httpError(404, 'Hóa đơn không tồn tại');
      if (!invoice.disabled) return invoice;

      const restore = async () => {
        // Mỗi lịch hẹn chỉ có 1 hóa đơn đang hoạt động
        const other = await InvoiceDAO.model.exists({
          appointment_id: invoice.appointment_id,
          disabled: false,
          _id: { $ne: invoice._id }
        });
        if (other) throw httpError(400, 'Lịch hẹn này đã có hóa đơn khác đang hoạt động');

        // Hóa đơn đã được hoàn kho khi xóa -> phải trừ lại đúng các lô đó
        if (invoice.stock_restored && invoice.stock_deductions?.length) {
          const ok = await reapplyDeductions(invoice.stock_deductions);
          if (!ok) throw httpError(400, 'Không đủ tồn kho để khôi phục hóa đơn này');
        }
        await InvoiceDAO.model.updateOne({ _id: invoiceId }, { $set: { stock_restored: false } });

        // Chỉ khôi phục các khoản thanh toán bị hủy do xóa hóa đơn, không hồi sinh khoản đã hủy riêng
        await PaymentDAO.model.updateMany(
          { invoice_id: invoiceId, disabled: true, disabled_by_cascade: true },
          { $set: { disabled: false }, $unset: { disabled_by_cascade: 1 } }
        );

        return InvoiceDAO.restore(invoiceId);
      };

      const hasAppointment = invoice.appointment_id && (await Appointment.exists({ _id: invoice.appointment_id }));
      return hasAppointment
        ? await withDocLock(Appointment, invoice.appointment_id, restore)
        : await restore();
    } catch (err) {
      throw err;
    }
  }
}

export default new InvoiceService();
