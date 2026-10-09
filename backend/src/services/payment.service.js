import Payment from '../models/payment.model.js';
import Invoice from '../models/invoice.model.js';
import paymentDao from '../dao/payment.dao.js';
import invoiceDao from '../dao/invoice.dao.js';
import withDocLock from '../utils/doc-lock.js';

// So sánh tiền theo đơn vị đồng (làm tròn 2 chữ số) để tránh sai số số thực
const toCents = (n) => Math.round(Number(n) * 100);

function parseAmount(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw Object.assign(new Error('Số tiền thanh toán không hợp lệ'), { status: 400 });
  }
  return amount;
}

const duplicateTxnError = () =>
  Object.assign(new Error('Giao dịch VNPay này đã được ghi nhận'), { status: 409, code: 'DUPLICATE_TXN' });

async function sumActivePayments(invoiceId, excludeId = null) {
  const filter = { invoice_id: invoiceId, disabled: false };
  if (excludeId) filter._id = { $ne: excludeId };
  const payments = await Payment.find(filter);
  return payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
}

class PaymentService {
  // Kế thừa
  // Mọi thao tác thay đổi số tiền đều chạy trong khóa theo hóa đơn: 2 khoản thanh toán gửi cùng lúc
  // không thể cùng vượt qua bước kiểm tra "còn lại" và làm hóa đơn bị trả vượt.
  // data đã được lọc ở nơi gọi; vnp_txn_ref/vnp_transaction_no chỉ do IPN VNPay truyền vào.
  async create(data) {
    const amount = parseAmount(data.amount);
    const invoiceId = data.invoice_id;

    const invoice = await invoiceDao.findById(invoiceId);
    if (!invoice) throw Object.assign(new Error('Hóa đơn không tồn tại'), { status: 404 });
    if (invoice.disabled) throw Object.assign(new Error('Hóa đơn đã bị xóa'), { status: 400 });

    return withDocLock(Invoice, invoiceId, async () => {
      // IPN gọi lặp lại cho cùng giao dịch VNPay -> không ghi lần 2 (kiểm tra trước bước "còn lại")
      if (data.vnp_txn_ref && (await Payment.exists({ vnp_txn_ref: data.vnp_txn_ref }))) {
        throw duplicateTxnError();
      }

      const totalPaid = await sumActivePayments(invoiceId);
      if (toCents(totalPaid) + toCents(amount) > toCents(invoice.total_amount)) {
        throw Object.assign(new Error('Số tiền thanh toán vượt quá số tiền còn lại'), { status: 400 });
      }

      let payment;
      try {
        payment = await paymentDao.create({ ...data, amount });
      } catch (err) {
        if (err.code === 11000 && err.keyPattern?.vnp_txn_ref) throw duplicateTxnError();
        throw err;
      }
      await this.#updateInvoiceStatus(invoiceId);
      return payment;
    });
  }

  async update(id, data) {
    const current = await paymentDao.findById(id);
    if (!current || current.disabled) throw Object.assign(new Error('Thanh toán không tồn tại'), { status: 404 });

    if (data.amount === undefined) {
      return paymentDao.update(id, data);
    }

    const amount = parseAmount(data.amount);
    return withDocLock(Invoice, current.invoice_id, async () => {
      const invoice = await invoiceDao.findById(current.invoice_id);
      if (!invoice) throw Object.assign(new Error('Hóa đơn không tồn tại'), { status: 404 });

      const otherPaid = await sumActivePayments(invoice._id, id);
      if (toCents(otherPaid) + toCents(amount) > toCents(invoice.total_amount)) {
        throw Object.assign(new Error('Số tiền thanh toán vượt quá số tiền còn lại'), { status: 400 });
      }

      const updated = await paymentDao.update(id, { ...data, amount });
      await this.#updateInvoiceStatus(invoice._id);
      return updated;
    });
  }

  async remove(id) {
    const payment = await paymentDao.findById(id);
    if (!payment) throw Object.assign(new Error('Thanh toán không tồn tại'), { status: 404 });

    if (!(await Invoice.exists({ _id: payment.invoice_id }))) {
      await paymentDao.delete(id);
      return;
    }
    // Cùng khóa với tạo/sửa thanh toán để trạng thái hóa đơn không bị tính trên dữ liệu cũ
    await withDocLock(Invoice, payment.invoice_id, async () => {
      await paymentDao.delete(id);
      await this.#updateInvoiceStatus(payment.invoice_id);
    });
  }

  async restore(id) {
    const payment = await paymentDao.findById(id);
    if (!payment) throw Object.assign(new Error('Thanh toán không tồn tại'), { status: 404 });
    if (!payment.disabled) return payment;

    return withDocLock(Invoice, payment.invoice_id, async () => {
      const invoice = await invoiceDao.findById(payment.invoice_id);
      if (!invoice) throw Object.assign(new Error('Hóa đơn không tồn tại'), { status: 404 });

      // Khôi phục không được làm hóa đơn bị trả vượt
      const totalPaid = await sumActivePayments(invoice._id);
      if (toCents(totalPaid) + toCents(payment.amount) > toCents(invoice.total_amount)) {
        throw Object.assign(new Error('Khôi phục khoản này sẽ làm hóa đơn bị thanh toán vượt'), { status: 400 });
      }

      await paymentDao.restore(id);
      await this.#updateInvoiceStatus(invoice._id);
    });
  }

  // Tính lại trạng thái từ DB sau khi ghi (không dựa vào số liệu truyền vào)
  async #updateInvoiceStatus(invoiceId) {
    const invoice = await Invoice.findById(invoiceId).select('total_amount');
    if (!invoice) return;
    const totalPaid = await sumActivePayments(invoiceId);

    let status = 'Unpaid';
    if (toCents(totalPaid) >= toCents(invoice.total_amount)) status = 'Paid';
    else if (totalPaid > 0) status = 'Partial';

    await invoiceDao.update(invoiceId, { status });
  }
  //
}

export default new PaymentService();
