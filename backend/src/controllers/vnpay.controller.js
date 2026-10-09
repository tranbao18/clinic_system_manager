import vnpay, { VNPAY_MIN_AMOUNT, VNPAY_MAX_AMOUNT } from '../utils/vnpay.js';
import invoiceDao from '../dao/invoice.dao.js';
import Payment from '../models/payment.model.js';
import PaymentService from '../services/payment.service.js';

// So sánh tiền theo xu (x100, số nguyên) để tránh sai số số thực
const toCents = (n) => Math.round(Number(n) * 100);
const formatVnd = (n) => new Intl.NumberFormat('vi-VN').format(n);

async function remainingCents(invoice) {
    const payments = await Payment.find({ invoice_id: invoice._id, disabled: false });
    const totalPaid = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    return toCents(invoice.total_amount) - toCents(totalPaid);
}

// IPN luôn trả HTTP 200 + RspCode theo đặc tả VNPay
const ipnReply = (res, RspCode, Message) => res.status(200).json({ RspCode, Message });

class VNPayController {
    // Kế thừa
    async createPaymentUrl(req, res) {
        try {
            const { invoice_id, bankCode } = req.body;

            if (!invoice_id) {
                return res.status(400).json({ error: 'Thiếu invoice_id' });
            }

            // 1. Kiểm tra invoice tồn tại
            const invoice = await invoiceDao.findById(invoice_id);
            if (!invoice) {
                return res.status(404).json({ error: 'Hóa đơn không tồn tại' });
            }

            // 2. Chỉ cho phép thanh toán đúng số tiền còn lại
            const amount = (await remainingCents(invoice)) / 100;
            if (amount <= 0) {
                return res.status(400).json({ error: 'Hóa đơn đã được thanh toán đầy đủ' });
            }
            if (amount < VNPAY_MIN_AMOUNT) {
                return res.status(400).json({
                    error: `Số tiền còn lại (${formatVnd(amount)}đ) nhỏ hơn mức tối thiểu VNPay cho phép (${formatVnd(VNPAY_MIN_AMOUNT)}đ). Vui lòng dùng phương thức thanh toán khác.`
                });
            }
            if (amount >= VNPAY_MAX_AMOUNT) {
                return res.status(400).json({ error: 'Số tiền vượt mức tối đa VNPay cho phép (dưới 1 tỷ đồng)' });
            }

            // 3. Mỗi lần bấm thanh toán là 1 mã giao dịch mới (thanh toán lại sau khi thất bại không bị VNPay từ chối)
            const paymentUrl = vnpay.createPaymentUrl({
                orderId: vnpay.buildTxnRef(invoice._id),
                amount,
                orderDescription: `Thanh toan hoa don ${invoice._id}`,
                orderType: 'other',
                locale: 'vn',
                bankCode: bankCode || undefined, // Nếu có chọn bank cụ thể
                ipAddr: vnpay.clientIp(req),
            });

            res.json({
                paymentUrl,
                invoice_id,
                amount,
            });
        } catch (err) {
            console.error('VNPay createPaymentUrl error:', err.message);
            if (err.code === 'VNPAY_NOT_CONFIGURED') {
                return res.status(500).json({ error: 'Thanh toán VNPay chưa được cấu hình trên máy chủ' });
            }
            res.status(500).json({ error: 'Không thể tạo liên kết thanh toán VNPay' });
        }
    }

    // Trình duyệt được VNPay chuyển về đây: CHỈ kiểm tra chữ ký rồi chuyển về trang hóa đơn.
    // Không ghi thanh toán (chỉ IPN ghi) -> tránh ghi trùng khi return và IPN đến cùng lúc.
    async returnUrl(req, res) {
        const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/+$/, '');
        let invoiceId = null;
        let success = false;
        try {
            const result = vnpay.verifyReturnUrl(req.query);
            invoiceId = vnpay.parseTxnRef(result.orderId);
            success = result.isValid && result.responseCode === '00' && result.transactionStatus === '00';
        } catch (err) {
            console.error('VNPay returnUrl error:', err.message);
        }

        const path = invoiceId ? `/dashboard/invoices/${invoiceId}` : '/dashboard/invoices';
        return res.redirect(`${frontendUrl}${path}?payment=${success ? 'success' : 'failed'}`);
    }

    // IPN (VNPay gọi server-to-server, có thể gọi lặp lại). RspCode:
    // 97 sai chữ ký | 01 không tìm thấy hóa đơn | 04 sai số tiền | 02 đã ghi nhận trước đó | 00 đã nhận | 99 lỗi khác
    async ipnUrl(req, res) {
        try {
            const result = vnpay.verifyReturnUrl(req.query);
            if (!result.isValid) return ipnReply(res, '97', 'Invalid signature');

            const invoiceId = vnpay.parseTxnRef(result.orderId);
            const invoice = invoiceId ? await invoiceDao.findById(invoiceId) : null;
            if (!invoice) return ipnReply(res, '01', 'Order not found');

            if (await Payment.exists({ vnp_txn_ref: result.orderId })) {
                return ipnReply(res, '02', 'Order already confirmed');
            }

            // Giao dịch thất bại/bị hủy: không ghi gì, chỉ xác nhận đã nhận kết quả
            if (result.responseCode !== '00' || result.transactionStatus !== '00') {
                return ipnReply(res, '00', 'Confirm Success');
            }

            // Số tiền gửi VNPay = số còn lại của hóa đơn lúc tạo URL (URL có chữ ký nên không sửa được).
            // Nếu số còn lại đã đổi (có khoản thanh toán khác / sửa tổng tiền) thì không khớp -> 04, không ghi.
            const remaining = await remainingCents(invoice);
            if (remaining <= 0) {
                console.warn(`VNPay IPN: hóa đơn ${invoiceId} đã thanh toán đủ, giao dịch ${result.orderId} cần đối soát`);
                return ipnReply(res, '02', 'Order already confirmed');
            }
            if (result.amountCents !== remaining) {
                console.warn(`VNPay IPN: số tiền giao dịch ${result.orderId} không khớp số còn lại của hóa đơn ${invoiceId}`);
                return ipnReply(res, '04', 'Invalid amount');
            }

            // Ghi qua PaymentService: khóa theo hóa đơn, chặn trả vượt, chặn trùng vnp_txn_ref
            await PaymentService.create({
                invoice_id: invoice._id,
                method: 'VNPay',
                amount: result.amountCents / 100,
                date: result.paidAt || new Date(),
                vnp_txn_ref: result.orderId,
                vnp_transaction_no: result.transactionId,
            });
            return ipnReply(res, '00', 'Confirm Success');
        } catch (err) {
            if (err.code === 'DUPLICATE_TXN') return ipnReply(res, '02', 'Order already confirmed');
            if (err.status === 404) return ipnReply(res, '01', 'Order not found');
            if (err.status === 400) return ipnReply(res, '04', 'Invalid amount');
            console.error('VNPay ipnUrl error:', err.message);
            return ipnReply(res, '99', 'Unknown error');
        }
    }
    //
}

export default new VNPayController();
