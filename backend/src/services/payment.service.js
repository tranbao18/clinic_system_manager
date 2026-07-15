import Payment from '../models/payment.model.js';
import paymentDao from '../dao/payment.dao.js';
import invoiceDao from '../dao/invoice.dao.js';

class PaymentService {
  // Kế thừa
  async create(data) {
    try {
      const { invoice_id, amount } = data;

      const invoice = await invoiceDao.findById(invoice_id);
      if (!invoice) throw new Error('Hóa đơn không tồn tại');

      const payments = await Payment.find({
        invoice_id,
        disabled: false
      });

      const totalPaid = payments.reduce((s, p) => s + (p.amount || 0), 0);
      const remaining = invoice.total_amount - totalPaid;

      if (amount > remaining) {
        throw new Error(`Số tiền thanh toán vượt quá số tiền còn lại`);
      }

      const payment = await paymentDao.create(data);

      await this.#updateInvoiceStatus(invoice, totalPaid + amount);

      return payment;

    } catch (err) {
      throw err;
    }
  }

  async update(id, data) {
    try {
      const current = await paymentDao.findById(id);
      if (!current) throw new Error('Thanh toán không tồn tại');

      if (data.amount !== undefined && data.amount !== current.amount) {
        const invoice = await invoiceDao.findById(current.invoice_id);
        if (!invoice) throw new Error('Hóa đơn không tồn tại');

        const payments = await Payment.find({
          invoice_id: invoice._id,
          disabled: false,
          _id: { $ne: id }
        });

        const totalPaid = payments.reduce((s, p) => s + (p.amount || 0), 0);

        if (data.amount > invoice.total_amount - totalPaid) {
          throw new Error('Số tiền thanh toán vượt quá số tiền còn lại');
        }

        const updated = await paymentDao.update(id, data);
        await this.#updateInvoiceStatus(invoice, totalPaid + data.amount);

        return updated;
      }

      const updated = await paymentDao.update(id, data);
      return updated;

    } catch (err) {
      throw err;
    }
  }

  async remove(id) {
    try {
      const payment = await paymentDao.findById(id);
      if (!payment) throw new Error('Thanh toán không tồn tại');

      await paymentDao.delete(id);

      const invoice = await invoiceDao.findById(payment.invoice_id);
      if (invoice) {
        const payments = await Payment.find({
          invoice_id: invoice._id,
          disabled: false
        });

        const totalPaid = payments.reduce((s, p) => s + (p.amount || 0), 0);
        await this.#updateInvoiceStatus(invoice, totalPaid);
      }

    } catch (err) {
      throw err;
    }
  }

  async restore(id) {
    try {
      const payment = await paymentDao.findById(id);
      if (!payment) throw new Error('Thanh toán không tồn tại');

      await paymentDao.restore(id);

      const invoice = await invoiceDao.findById(payment.invoice_id);
      if (!invoice) throw new Error('Hóa đơn không tồn tại');

      const payments = await Payment.find({
        invoice_id: invoice._id,
        disabled: false
      });

      const totalPaid = payments.reduce((s, p) => s + (p.amount || 0), 0);
      await this.#updateInvoiceStatus(invoice, totalPaid);

    } catch (err) {
      throw err;
    }
  }

  async #updateInvoiceStatus(invoice, totalPaid) {
    let status = 'Unpaid';
    if (totalPaid >= invoice.total_amount) status = 'Paid';
    else if (totalPaid > 0) status = 'Partial';

    await invoiceDao.update(invoice._id, { status });
  }
  //
}

export default new PaymentService();