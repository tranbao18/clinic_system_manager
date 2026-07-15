import InvoiceDAO from '../dao/invoice.dao.js';
import PaymentDAO from '../dao/payment.dao.js';

class InvoiceService {
  async deleteCascade(invoiceId) {
    try {
      await PaymentDAO.model.updateMany(
        { invoice_id: invoiceId, disabled: false },
        { disabled: true }
      );

      const result = await InvoiceDAO.delete(invoiceId);
      return result;
    } catch (err) {
      throw err;
    }
  }

  async restoreCascade(invoiceId) {
    try {
      await PaymentDAO.model.updateMany(
        { invoice_id: invoiceId, disabled: true },
        { disabled: false }
      );

      const result = await InvoiceDAO.restore(invoiceId);
      return result;
    } catch (err) {
      throw err;
    }
  }
}

export default new InvoiceService();