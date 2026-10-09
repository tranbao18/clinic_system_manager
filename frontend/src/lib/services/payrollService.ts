import { getAuthHeaderClient, handleAuthRedirect } from "@/lib/authHeaderClient";

const BASE_URL = "/api/payrolls";

export interface Payroll {
    _id: string;
    // employee_id có thể là null khi nhân viên đã bị xóa (populate trả về null)
    employee_id: string | {
        _id: string;
        fullname: string;
        email: string;
        position: string;
    } | null;
    basic_salary: number;
    bonus?: number;
    deductions?: number;
    net_salary: number;
    paydate: string;
    accountant_id?: string;
    updated_at: string;
    disabled: boolean;
    emailSent?: boolean;
    emailError?: string;
    message?: string;
}

export interface CreatePayrollData {
    employee_id: string;
    basic_salary: number;
    bonus?: number;
    deductions?: number;
    /** Chỉ để tham khảo: backend luôn tự tính lại lương thực nhận */
    net_salary?: number;
    /** Ngày dạng YYYY-MM-DD */
    paydate: string;
    accountant_id?: string;
}

export interface UpdatePayrollData {
    bonus?: number;
    deductions?: number;
    basic_salary?: number;
    net_salary?: number;
}

export interface SendPayrollResult {
    payrollId: string;
    status: "success" | "failed";
    message?: string;
}

/** Lấy id nhân viên của bảng lương, an toàn khi employee_id là null */
export function getPayrollEmployeeId(p: Pick<Payroll, "employee_id">): string | null {
    if (!p.employee_id) return null;
    return typeof p.employee_id === "string" ? p.employee_id : p.employee_id._id ?? null;
}

// Đọc body một lần; lỗi thì ném Error kèm thông báo backend (vd: lương âm, trùng tháng); 401 chuyển về đăng nhập
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

const PayrollService = {
    async getAll(): Promise<Payroll[]> {
        const res = await fetch(BASE_URL, {
            cache: "no-store",
            headers: getAuthHeaderClient(),
        });
        const data = await parseResponse<unknown>(res, "Lỗi khi tải danh sách bảng lương");
        return Array.isArray(data) ? data : [];
    },

    async getById(id: string): Promise<Payroll> {
        const res = await fetch(`${BASE_URL}/${id}`, {
            cache: "no-store",
            headers: getAuthHeaderClient(),
        });
        return parseResponse<Payroll>(res, "Lỗi khi tải bảng lương");
    },

    async create(data: CreatePayrollData): Promise<Payroll> {
        const res = await fetch(BASE_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...getAuthHeaderClient(),
            },
            body: JSON.stringify(data),
        });
        return parseResponse<Payroll>(res, "Lỗi khi tạo bảng lương");
    },

    async update(id: string, data: UpdatePayrollData, sendEmail: boolean = true): Promise<Payroll> {
        const queryParam = sendEmail ? "" : "?sendEmail=false";
        const res = await fetch(`${BASE_URL}/${id}${queryParam}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                ...getAuthHeaderClient(),
            },
            body: JSON.stringify(data),
        });
        return parseResponse<Payroll>(res, "Lỗi khi cập nhật bảng lương");
    },

    async delete(id: string): Promise<{ message?: string }> {
        const res = await fetch(`${BASE_URL}/${id}`, {
            method: "DELETE",
            headers: getAuthHeaderClient(),
        });
        return (await parseResponse<{ message?: string } | null>(res, "Lỗi khi xóa bảng lương")) ?? {};
    },

    /** Gửi email đúng bảng lương được chọn (theo payroll id) */
    async sendPayrollEmail(payrollId: string): Promise<{ message?: string }> {
        const res = await fetch(`${BASE_URL}/send/payroll/${payrollId}`, {
            method: "POST",
            headers: getAuthHeaderClient(),
        });
        return (await parseResponse<{ message?: string } | null>(res, "Lỗi khi gửi email")) ?? {};
    },

    /** Gửi email hàng loạt theo danh sách payroll id */
    async sendPayrollEmailBulk(payrollIds: string[]): Promise<{ message?: string; results?: SendPayrollResult[] }> {
        const res = await fetch(`${BASE_URL}/send/payroll/bulk`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...getAuthHeaderClient(),
            },
            body: JSON.stringify({ payroll_ids: payrollIds }),
        });
        return (
            (await parseResponse<{ message?: string; results?: SendPayrollResult[] } | null>(
                res,
                "Lỗi khi gửi email hàng loạt"
            )) ?? {}
        );
    },

    async getByEmployeeId(employeeId: string): Promise<Payroll[]> {
        const allPayrolls = await this.getAll();
        return allPayrolls.filter(
            (p) => getPayrollEmployeeId(p) === employeeId && !p.disabled
        );
    },
};

export default PayrollService;
