import crypto from 'crypto';
import qs from 'qs';
import moment from 'moment';
import 'moment-timezone';

// Số tiền VNPay chấp nhận cho 1 giao dịch (VND): từ 5.000 đến dưới 1 tỷ
export const VNPAY_MIN_AMOUNT = 5000;
export const VNPAY_MAX_AMOUNT = 1000000000;

const VN_TZ = 'Asia/Ho_Chi_Minh';

// IP dạng IPv4/IPv6 (bỏ tiền tố ::ffff:), không hợp lệ thì dùng 127.0.0.1
function normalizeIp(ip) {
    let s = String(ip || '').trim();
    if (s.toLowerCase().startsWith('::ffff:')) s = s.slice(7);
    if (s === '::1') s = '127.0.0.1';
    return /^[0-9a-fA-F:.]{3,45}$/.test(s) ? s : '127.0.0.1';
}

// Kế thừa
/**
 * VNPay Utility
 * Hỗ trợ tạo payment URL và verify callback từ VNPay
*/
class VNPay {
    constructor() {
        // Không load config trong constructor vì dotenv có thể chưa được load
        // Sẽ load config khi cần sử dụng (lazy loading)
        this._configLoaded = false;
    }

    // Lazy load config - chỉ load khi cần sử dụng
    _loadConfig() {
        if (this._configLoaded) return;

        // Lấy config từ environment variables
        this.tmnCode = process.env.VNPAY_TMN_CODE || '';
        this.hashSecret = process.env.VNPAY_HASH_SECRET || '';
        this.paymentUrl = process.env.VNPAY_PAYMENT_URL || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
        // Sử dụng PORT từ env hoặc default 5050 (vì Mac thường conflict port 5000)
        const backendPort = process.env.PORT || 5050;
        // Return URL trỏ về backend: backend kiểm tra chữ ký rồi redirect về frontend
        this.returnUrl = process.env.VNPAY_RETURN_URL || `http://localhost:${backendPort}/api/payments/vnpay-return`;
        this.ipnUrl = process.env.VNPAY_IPN_URL || `http://localhost:${backendPort}/api/payments/vnpay-ipn`;

        this._configLoaded = true;

        // Chỉ log trạng thái có/không, không log bất kỳ phần nào của secret
        console.log('🔧 VNPay Config Status:', {
            hasTmnCode: !!this.tmnCode,
            hasHashSecret: !!this.hashSecret,
            paymentUrl: this.paymentUrl,
            returnUrl: this.returnUrl,
        });
    }

    /**
     * Mã giao dịch (vnp_TxnRef) duy nhất cho MỖI lần thanh toán: <invoiceId 24 ký tự><thời điểm ms><3 số ngẫu nhiên>.
     * VNPay từ chối TxnRef trùng nên không thể dùng nguyên invoiceId khi thanh toán lại sau lần thất bại.
     * Chỉ gồm chữ và số (VNPay: tối đa 100 ký tự).
     */
    buildTxnRef(invoiceId) {
        const id = String(invoiceId || '');
        if (!/^[a-f0-9]{24}$/i.test(id)) throw new Error('invoiceId không hợp lệ');
        return `${id}${Date.now()}${String(crypto.randomInt(0, 1000)).padStart(3, '0')}`;
    }

    // Lấy lại invoiceId từ vnp_TxnRef (chấp nhận cả mã cũ chỉ gồm invoiceId)
    parseTxnRef(txnRef) {
        const m = /^([a-f0-9]{24})\d*$/i.exec(typeof txnRef === 'string' ? txnRef : '');
        return m ? m[1].toLowerCase() : null;
    }

    clientIp(req) {
        // Sau proxy (Vercel) IP thật của người dùng là phần tử đầu của x-forwarded-for
        const forwarded = req.headers?.['x-forwarded-for'];
        const first = String(Array.isArray(forwarded) ? forwarded[0] : forwarded || '').split(',')[0].trim();
        return normalizeIp(first || req.ip || req.socket?.remoteAddress);
    }

    /**
     * Tạo payment URL từ VNPay
     * @param {Object} params - Thông tin đơn hàng
     * @param {string} params.orderId - Mã giao dịch (vnp_TxnRef, tạo bằng buildTxnRef)
     * @param {number} params.amount - Số tiền (VND)
     * @param {string} params.orderDescription - Mô tả đơn hàng
     * @param {string} params.orderType - Loại đơn hàng
     * @param {string} params.locale - Ngôn ngữ (vn/en)
     * @param {string} params.ipAddr - IP của người thanh toán
     * @returns {string} Payment URL
    */
    createPaymentUrl(params) {
        // Load config nếu chưa load (lazy loading)
        this._loadConfig();

        // Kiểm tra config
        if (!this.tmnCode || !this.hashSecret) {
            throw Object.assign(
                new Error('VNPay chưa được cấu hình. Vui lòng kiểm tra VNPAY_TMN_CODE và VNPAY_HASH_SECRET trong file .env'),
                { code: 'VNPAY_NOT_CONFIGURED' }
            );
        }

        const {
            orderId,
            amount,
            orderDescription = 'Thanh toan hoa don',
            orderType = 'other',
            locale = 'vn',
        } = params;

        // VNPay yêu cầu vnp_TxnRef: chữ và số, tối đa 100 ký tự
        const vnp_TxnRef = String(orderId || '');
        if (!/^[A-Za-z0-9]{1,100}$/.test(vnp_TxnRef)) {
            throw new Error('Mã giao dịch không hợp lệ');
        }

        // Validate và format orderDescription (vnp_OrderInfo)
        // VNPay yêu cầu: max 255 ký tự
        // Lưu ý: VNPay có thể yêu cầu URL encoding, nhưng trong signData thì không encode
        let vnp_OrderInfo = orderDescription.substring(0, 255);
        // Loại bỏ ký tự đặc biệt có thể gây lỗi
        vnp_OrderInfo = vnp_OrderInfo.replace(/[<>\"'&]/g, '');

        // Amount tính bằng xu (x100). Làm tròn (không cắt) để 1234.565 không thành 123456
        const value = Number(amount);
        if (!Number.isFinite(value) || value < VNPAY_MIN_AMOUNT || value >= VNPAY_MAX_AMOUNT) {
            throw new Error('Số tiền thanh toán VNPay không hợp lệ');
        }
        const vnp_Amount = Math.round(value * 100);

        // Đảm bảo tạo time theo múi giờ Việt Nam (GMT+7)
        const vnTime = moment().tz(VN_TZ);
        const createDate = vnTime.format('YYYYMMDDHHmmss');
        const expireDate = vnTime.clone().add(15, 'minutes').format('YYYYMMDDHHmmss');

        // Hỗ trợ cấu hình cũ có placeholder [invoice_id] trong return URL
        let vnp_ReturnUrl = this.returnUrl;
        if (vnp_ReturnUrl.includes('[invoice_id]')) {
            vnp_ReturnUrl = vnp_ReturnUrl.replace('[invoice_id]', this.parseTxnRef(vnp_TxnRef) || vnp_TxnRef);
        }

        // Tạo vnp_Params
        const vnp_Params = {
            vnp_Version: '2.1.0',
            vnp_Command: 'pay',
            vnp_TmnCode: this.tmnCode,
            vnp_Amount: vnp_Amount.toString(), // VNPay yêu cầu amount tính bằng xu (x100) và là string
            vnp_CurrCode: 'VND',
            vnp_TxnRef: vnp_TxnRef,
            vnp_OrderInfo: vnp_OrderInfo,
            vnp_OrderType: orderType,
            vnp_Locale: locale,
            vnp_ReturnUrl: vnp_ReturnUrl,
            vnp_IpAddr: normalizeIp(params.ipAddr),
            vnp_CreateDate: createDate,
            vnp_ExpireDate: expireDate,
        };

        // Thêm vnp_BankCode nếu có
        if (params.bankCode) {
            vnp_Params.vnp_BankCode = params.bankCode;
        }

        // sortedParams đã được encode trong sortObject, nên dùng encode: false
        const { sorted, signature } = this._sign(vnp_Params);
        sorted.vnp_SecureHash = signature;

        return this.paymentUrl + '?' + qs.stringify(sorted, { encode: false });
    }

    /**
     * Verify callback từ VNPay (dùng cho cả return URL và IPN). Không sửa object truyền vào.
     * @param {Object} query - Params từ VNPay callback
     * @returns {Object} {isValid, responseCode, transactionStatus, ...}
    */
    verifyReturnUrl(query) {
        // Load config nếu chưa load (lazy loading)
        this._loadConfig();

        // Chỉ ký trên các tham số vnp_* (trừ chính chữ ký)
        const vnp_Params = {};
        for (const [key, value] of Object.entries(query || {})) {
            if (key.startsWith('vnp_') && key !== 'vnp_SecureHash' && key !== 'vnp_SecureHashType') {
                vnp_Params[key] = value;
            }
        }

        // Chưa cấu hình secret thì không bao giờ hợp lệ (HMAC với khóa rỗng thì ai cũng tạo được)
        const secureHash = typeof query?.vnp_SecureHash === 'string' ? query.vnp_SecureHash : '';
        let isValid = false;
        if (this.hashSecret && /^[0-9a-f]{128}$/i.test(secureHash)) {
            const expected = Buffer.from(this._sign(vnp_Params).signature, 'hex');
            isValid = crypto.timingSafeEqual(expected, Buffer.from(secureHash, 'hex'));
        }

        const rawAmount = typeof vnp_Params.vnp_Amount === 'string' ? vnp_Params.vnp_Amount : '';
        const amountCents = /^\d+$/.test(rawAmount) ? Number(rawAmount) : NaN; // VNPay gửi theo xu (x100)
        const paidAt = moment.tz(String(vnp_Params.vnp_PayDate || ''), 'YYYYMMDDHHmmss', true, VN_TZ);

        return {
            isValid,
            orderId: vnp_Params.vnp_TxnRef,
            transactionId: vnp_Params.vnp_TransactionNo,
            responseCode: vnp_Params.vnp_ResponseCode,
            amountCents,
            amount: Number.isFinite(amountCents) ? amountCents / 100 : 0, // Chuyển từ xu về VND
            bankCode: vnp_Params.vnp_BankCode,
            transactionStatus: vnp_Params.vnp_TransactionStatus,
            payDate: vnp_Params.vnp_PayDate,
            paidAt: paidAt.isValid() ? paidAt.toDate() : null,
            message: this.getResponseMessage(vnp_Params.vnp_ResponseCode),
        };
    }

    // Chuỗi ký = các cặp key=value (đã encode kiểu VNPay) theo thứ tự key, nối bằng &; HMAC-SHA512
    _sign(params) {
        const sorted = this.sortObject(params);
        const signData = Object.keys(sorted)
            .map(key => `${key}=${sorted[key]}`)
            .join('&');
        const signature = crypto.createHmac('sha512', this.hashSecret)
            .update(Buffer.from(signData, 'utf-8'))
            .digest('hex');
        return { sorted, signature };
    }

    // Format date theo format VNPay yêu cầu (yyyyMMddHHmmss)
    formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        return `${year}${month}${day}${hours}${minutes}${seconds}`;
    }

    // Sắp xếp object theo key và encode values (theo format VNPay)
    sortObject(obj) {
        const sorted = {};
        const keys = Object.keys(obj).sort();
        keys.forEach(key => {
            // VNPay yêu cầu: encode giá trị và thay %20 bằng +
            const value = obj[key];
            const encoded = encodeURIComponent(value).replace(/%20/g, '+');
            sorted[key] = encoded;
        });
        return sorted;
    }

    // Lấy message từ response code
    getResponseMessage(responseCode) {
        const responseMessages = {
            '00': 'Giao dịch thành công',
            '07': 'Trừ tiền thành công. Giao dịch bị nghi ngờ (liên quan tới lừa đảo, giao dịch bất thường).',
            '09': 'Thẻ/Tài khoản chưa đăng ký dịch vụ InternetBanking',
            '10': 'Xác thực thông tin thẻ/tài khoản không đúng quá 3 lần',
            '11': 'Đã hết hạn chờ thanh toán. Vui lòng thực hiện lại giao dịch.',
            '12': 'Thẻ/Tài khoản bị khóa.',
            '13': 'Nhập sai mật khẩu xác thực giao dịch (OTP).',
            '51': 'Tài khoản không đủ số dư để thực hiện giao dịch.',
            '65': 'Tài khoản đã vượt quá hạn mức giao dịch trong ngày.',
            '75': 'Ngân hàng thanh toán đang bảo trì.',
            '79': 'Nhập sai mật khẩu thanh toán quá số lần quy định.',
            '99': 'Lỗi không xác định.',
        };
        return responseMessages[responseCode] || 'Lỗi không xác định';
    }
}
//

export default new VNPay();
