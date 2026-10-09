import { getAuthHeaderClient, handleAuthRedirect } from "@/lib/authHeaderClient";

export interface Payment {
    _id: string;
    invoice_id: string | {
        _id: string;
        total_amount?: number;
        status?: string;
        patient_id?: { fullname?: string; phone?: string };
        appointment_id?: { appointment_date?: string };
    };
    method: string;
    amount: number;
    date: string;
    updated_at: string;
    disabled?: boolean;
}

export interface CreatePaymentData {
    invoice_id: string;
    method: string;
    amount: number;
    date: string;
}

export interface UpdatePaymentData {
    method?: string;
    amount?: number;
    date?: string;
}

// Đọc body một lần; lỗi thì ném Error kèm thông báo backend (vd: vượt số tiền còn lại); 401 chuyển về đăng nhập
async function parseResponse<T>(res: Response, fallback: string): Promise<T> {
    const text = await res.text();
    let data: unknown = null;
    try {
        data = text ? JSON.parse(text) : null;
    } catch {
        data = null;
    }
    if (!res.ok) {
        if (res.status === 401) handleAuthRedirect();
        const body = (data && typeof data === "object" ? data : {}) as { error?: unknown; message?: unknown };
        const msg =
            (typeof body.error === "string" && body.error) ||
            (typeof body.message === "string" && body.message) ||
            fallback;
        throw Object.assign(new Error(msg), { status: res.status, data });
    }
    return data as T;
}

export async function getPayments(filters?: {
    invoice_id?: string;
}): Promise<Payment[]> {
    const params = new URLSearchParams();
    if (filters?.invoice_id) params.append("invoice_id", filters.invoice_id);
    const url = params.toString() ? `/api/payments?${params.toString()}` : "/api/payments";

    const res = await fetch(url, {
        cache: "no-store",
        headers: getAuthHeaderClient(),
    });
    const data = await parseResponse<unknown>(res, "Không thể lấy danh sách thanh toán");
    return Array.isArray(data) ? data : [];
}

export async function getPaymentById(id: string): Promise<Payment> {
    const res = await fetch(`/api/payments/${id}`, {
        cache: "no-store",
        headers: getAuthHeaderClient(),
    });
    return parseResponse<Payment>(res, "Không thể lấy thông tin thanh toán");
}

export async function getPaymentsByInvoiceId(invoiceId: string): Promise<Payment[]> {
    const res = await fetch(`/api/payments/invoice/${invoiceId}`, {
        cache: "no-store",
        headers: getAuthHeaderClient(),
    });
    const data = await parseResponse<unknown>(res, "Không thể lấy thanh toán của hóa đơn");
    return Array.isArray(data) ? data : [];
}

export async function createPayment(data: CreatePaymentData): Promise<Payment> {
    const res = await fetch("/api/payments", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...getAuthHeaderClient(),
        },
        body: JSON.stringify(data),
    });
    return parseResponse<Payment>(res, "Không thể tạo thanh toán");
}

export async function updatePayment(
    id: string,
    data: UpdatePaymentData
): Promise<Payment> {
    const res = await fetch(`/api/payments/${id}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            ...getAuthHeaderClient(),
        },
        body: JSON.stringify(data),
    });
    return parseResponse<Payment>(res, "Không thể cập nhật thanh toán");
}

export async function deletePayment(id: string): Promise<void> {
    const res = await fetch(`/api/payments/${id}`, {
        method: "DELETE",
        headers: getAuthHeaderClient(),
    });
    await parseResponse<unknown>(res, "Không thể xóa thanh toán");
}

export interface CreateVNPayUrlData {
    invoice_id: string;
    bankCode?: string;
}

export interface VNPayUrlResponse {
    paymentUrl: string;
    invoice_id: string;
    amount: number;
}

export async function createVNPayUrl(data: CreateVNPayUrlData): Promise<VNPayUrlResponse> {
    const res = await fetch("/api/payments/vnpay/create", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...getAuthHeaderClient(),
        },
        body: JSON.stringify(data),
    });
    return parseResponse<VNPayUrlResponse>(res, "Không thể tạo URL thanh toán VNPay");
}

export interface CreateVNPayQRData {
    invoice_id: string;
}

export interface VNPayQRResponse {
    qrData: string;
    paymentUrl: string;
    invoice_id: string;
    amount: number;
    expireDate: string;
}

export async function createVNPayQR(data: CreateVNPayQRData): Promise<VNPayQRResponse> {
    const res = await fetch("/api/payments/vnpay/create-qr", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...getAuthHeaderClient(),
        },
        body: JSON.stringify(data),
    });
    return parseResponse<VNPayQRResponse>(res, "Không thể tạo QR code VNPay");
}
