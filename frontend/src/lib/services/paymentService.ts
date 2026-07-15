import { getAuthHeaderClient } from "@/lib/authHeaderClient";

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

export async function getPayments(filters?: {
    invoice_id?: string;
}): Promise<Payment[]> {
    try {
        const authHeaders = await getAuthHeaderClient();
        let url = "/api/payments";
        const params = new URLSearchParams();

        if (filters?.invoice_id) params.append('invoice_id', filters.invoice_id);

        if (params.toString()) {
            url += `?${params.toString()}`;
        }

        const res = await fetch(url, {
            cache: "no-store",
            headers: authHeaders
        });
        if (!res.ok) throw new Error("Không thể lấy danh sách thanh toán");
        return res.json();
    } catch (error: any) {
        console.error("getPayments error:", error);
        return [];
    }
}

export async function getPaymentById(id: string): Promise<Payment> {
    const authHeaders = await getAuthHeaderClient();
    const res = await fetch(`/api/payments/${id}`, {
        cache: "no-store",
        headers: authHeaders
    });
    if (!res.ok) throw new Error("Không thể lấy thông tin thanh toán");
    return res.json();
}

export async function getPaymentsByInvoiceId(invoiceId: string): Promise<Payment[]> {
    const authHeaders = await getAuthHeaderClient();
    const res = await fetch(`/api/payments/invoice/${invoiceId}`, {
        cache: "no-store",
        headers: authHeaders
    });
    if (!res.ok) throw new Error("Không thể lấy thanh toán của hóa đơn");
    return res.json();
}

export async function createPayment(data: CreatePaymentData): Promise<Payment> {
    const authHeaders = await getAuthHeaderClient();
    const res = await fetch("/api/payments", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...authHeaders
        },
        body: JSON.stringify(data),
    });
    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Không thể tạo thanh toán");
    }
    return res.json();
}

export async function updatePayment(
    id: string,
    data: UpdatePaymentData
): Promise<Payment> {
    const authHeaders = await getAuthHeaderClient();
    const res = await fetch(`/api/payments/${id}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            ...authHeaders
        },
        body: JSON.stringify(data),
    });
    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Không thể cập nhật thanh toán");
    }
    return res.json();
}

export async function deletePayment(id: string): Promise<void> {
    const authHeaders = await getAuthHeaderClient();
    const res = await fetch(`/api/payments/${id}`, {
        method: "DELETE",
        headers: authHeaders
    });
    if (!res.ok) throw new Error("Không thể xóa thanh toán");
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
    try {
        const authHeaders = await getAuthHeaderClient();
        const res = await fetch("/api/payments/vnpay/create", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...authHeaders
            },
            body: JSON.stringify(data),
        });

        if (!res.ok) {
            const text = await res.text();
            let errorData;
            try {
                errorData = JSON.parse(text);
            } catch {
                errorData = { error: text || "Lỗi không xác định" };
            }
            console.error("❌ VNPay API error:", {
                status: res.status,
                statusText: res.statusText,
                error: errorData
            });

            let errorMessage = "Không thể tạo URL thanh toán VNPay";
            if (res.status === 403) {
                errorMessage = errorData.error || "Bạn không có quyền thực hiện thao tác này. Vui lòng đăng nhập với tài khoản Admin hoặc Accountant.";
            } else if (res.status === 401) {
                errorMessage = errorData.error || "Bạn cần đăng nhập để thực hiện thao tác này.";
            } else {
                errorMessage = errorData.error || errorData.detail || errorMessage;
            }

            throw new Error(errorMessage);
        }

        const text = await res.text();
        try {
            return JSON.parse(text);
        } catch {
            throw new Error("Response không phải JSON hợp lệ");
        }
    } catch (error: any) {
        console.error("createVNPayUrl error:", error);
        throw error;
    }
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
    try {
        const authHeaders = await getAuthHeaderClient();
        const res = await fetch("/api/payments/vnpay/create-qr", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...authHeaders
            },
            body: JSON.stringify(data),
        });

        if (!res.ok) {
            const text = await res.text();
            let errorData;
            try {
                errorData = JSON.parse(text);
            } catch {
                errorData = { error: text || "Lỗi không xác định" };
            }
            console.error("❌ VNPay QR API error:", {
                status: res.status,
                statusText: res.statusText,
                error: errorData
            });

            let errorMessage = "Không thể tạo QR code VNPay";
            if (res.status === 403) {
                errorMessage = errorData.error || "Bạn không có quyền thực hiện thao tác này. Vui lòng đăng nhập với tài khoản Admin hoặc Accountant.";
            } else if (res.status === 401) {
                errorMessage = errorData.error || "Bạn cần đăng nhập để thực hiện thao tác này.";
            } else {
                errorMessage = errorData.error || errorData.detail || errorMessage;
            }

            throw new Error(errorMessage);
        }

        const text = await res.text();
        try {
            return JSON.parse(text);
        } catch {
            throw new Error("Response không phải JSON hợp lệ");
        }
    } catch (error: any) {
        console.error("createVNPayQR error:", error);
        throw error;
    }
}

