import vnpay from '../utils/vnpay.js';
import paymentDao from '../dao/payment.dao.js';
import invoiceDao from '../dao/invoice.dao.js';
import Payment from '../models/payment.model.js';

class VNPayController {
    // Kế thừa
    async createPaymentUrl(req, res) {
        try {
            const { invoice_id, bankCode } = req.body;
            console.log('📥 Nhận request tạo VNPay URL:', { invoice_id, bankCode });

            if (!invoice_id) {
                return res.status(400).json({ error: 'Thiếu invoice_id' });
            }

            // 1. Kiểm tra invoice tồn tại
            const invoice = await invoiceDao.findById(invoice_id);
            if (!invoice) {
                console.error('❌ Invoice không tồn tại:', invoice_id);
                return res.status(404).json({ error: 'Hóa đơn không tồn tại' });
            }

            // 2. Tính tổng payment hiện tại
            const existingPayments = await Payment.find({
                invoice_id: invoice_id,
                disabled: false
            });
            const totalPaid = existingPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
            const remaining = invoice.total_amount - totalPaid;

            if (remaining <= 0) {
                return res.status(400).json({ error: 'Hóa đơn đã được thanh toán đầy đủ' });
            }

            // 3. Tạo payment URL từ VNPay
            console.log('🔄 Tạo VNPay URL cho invoice:', invoice_id, 'amount:', remaining);
            try {
                const paymentUrl = vnpay.createPaymentUrl({
                    orderId: invoice_id.toString(),
                    amount: remaining, // Chỉ cho phép thanh toán số tiền còn lại
                    orderDescription: `Thanh toan hoa don ${invoice_id}`,
                    orderType: 'other',
                    locale: 'vn',
                    bankCode: bankCode || undefined, // Nếu có chọn bank cụ thể
                });
                console.log('✅ VNPay URL đã được tạo thành công');

                res.json({
                    paymentUrl,
                    invoice_id,
                    amount: remaining,
                });
            } catch (vnpayError) {
                console.error('❌ Lỗi khi tạo VNPay URL:', vnpayError);
                // Nếu là lỗi config, trả về 500 với message rõ ràng
                if (vnpayError.message.includes('chưa được cấu hình')) {
                    return res.status(500).json({
                        error: vnpayError.message,
                        detail: 'Vui lòng kiểm tra file .env và đảm bảo VNPAY_TMN_CODE và VNPAY_HASH_SECRET đã được cấu hình'
                    });
                }
                throw vnpayError;
            }
        } catch (err) {
            console.error('❌ VNPay createPaymentUrl error:', err);
            res.status(500).json({
                error: err.message || 'Lỗi không xác định khi tạo VNPay URL',
                detail: err.stack
            });
        }
    }

    async returnUrl(req, res) {
        try {
            const result = vnpay.verifyReturnUrl(req.query);
            const invoice_id = result.orderId;
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

            if (!result.isValid || result.responseCode !== '00' || result.transactionStatus !== '00') {
            return res.redirect(`${frontendUrl}/dashboard/invoices/${invoice_id}?payment=failed`);
            }

            const existingPayment = await Payment.findOne(
            { invoice_id, method: 'VNPay', disabled: false }
            );

            if (!existingPayment) {
            const invoice = await invoiceDao.findById(invoice_id);
            if (!invoice) throw new Error('Invoice not found');

            const payments = await Payment.find(
                { invoice_id, disabled: false }
            );
            const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
            const remaining = invoice.total_amount - totalPaid;

            if (result.amount > remaining) {
                throw new Error('Payment amount exceeds remaining');
            }

            await paymentDao.create({
                invoice_id,
                method: 'VNPay',
                amount: result.amount,
                date: new Date()
            });

            const newTotal = totalPaid + result.amount;
            const newStatus =
                newTotal >= invoice.total_amount ? 'Paid' :
                newTotal > 0 ? 'Partial' : 'Unpaid';

            await invoiceDao.update(invoice_id, { status: newStatus });
            }

            return res.redirect(`${frontendUrl}/dashboard/invoices/${invoice_id}?payment=success`);
        } catch (err) {
            console.error('VNPay returnUrl error:', err);
            return res.redirect(
            `${process.env.FRONTEND_URL}/dashboard/invoices/${req.query.vnp_TxnRef}?payment=failed`
            );
        }
    }

    async ipnUrl(req, res) {
        try {
            const result = vnpay.verifyReturnUrl(req.query);
            if (!result.isValid) {
            return res.status(400).json({ RspCode: '97', Message: 'Invalid signature' });
            }

            const invoice_id = result.orderId;
            const invoice = await invoiceDao.findById(invoice_id);
            if (!invoice) throw new Error('Invoice not found');

            if (result.transactionStatus === '00' && result.responseCode === '00') {
            const existingPayment = await Payment.findOne(
                { invoice_id, method: 'VNPay', disabled: false }
            );

            if (!existingPayment) {
                await paymentDao.create({
                invoice_id,
                method: 'VNPay',
                amount: result.amount,
                date: new Date()
                });

                await invoiceDao.update(invoice_id, { status: 'Paid' });
            }
            }

            return res.status(200).json({ RspCode: '00', Message: 'Success' });
        } catch (err) {
            console.error('VNPay ipnUrl error:', err);
            return res.status(500).json({ RspCode: '99', Message: err.message });
        }
    }
    //
}

export default new VNPayController();