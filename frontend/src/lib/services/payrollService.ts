import { getAuthHeaderClient } from "@/lib/authHeaderClient";

const BASE_URL = "/api/payrolls";

export interface Payroll {
    _id: string;
    employee_id: string | {
        _id: string;
        fullname: string;
        email: string;
        position: string;
    };
    basic_salary: number;
    bonus?: number;
    deductions?: number;
    net_salary: number;
    paydate: string;
    accountant_id?: string;
    updated_at: string;
    disabled: boolean;
    emailSent?: boolean;
    message?: string;
}

export interface CreatePayrollData {
    employee_id: string;
    basic_salary: number;
    bonus?: number;
    deductions?: number;
    net_salary?: number;
    paydate: string;
    accountant_id?: string;
}

export interface UpdatePayrollData {
    bonus?: number;
    deductions?: number;
    basic_salary?: number;
    net_salary?: number;
}

const PayrollService = {
    async getAll() {
        try {
            const res = await fetch(BASE_URL, {
                cache: "no-store",
                headers: getAuthHeaderClient(),
            });
            if (!res.ok) throw new Error("Lỗi khi tải danh sách bảng lương");
            return await res.json();
        } catch (error: any) {
            console.error("getAll error:", error.message);
            throw error;
        }
    },

    async getById(id: string) {
        try {
            const res = await fetch(`${BASE_URL}/${id}`, {
                cache: "no-store",
                headers: getAuthHeaderClient(),
            });
            const text = await res.text();
            if (!res.ok) throw new Error(`Lỗi khi tải bảng lương: ${text}`);
            return JSON.parse(text);
        } catch (error: any) {
            console.error("getById error:", error.message);
            throw error;
        }
    },

    async create(data: CreatePayrollData) {
        try {
            const res = await fetch(BASE_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...getAuthHeaderClient(),
                },
                body: JSON.stringify(data),
            });

            const text = await res.text();

            if (!res.ok) {
                console.error("Backend error:", text);
                throw new Error(`Lỗi khi tạo bảng lương: ${text}`);
            }

            try {
                return JSON.parse(text);
            } catch (err) {
                console.error("❌ Response không phải JSON:", text);
                throw new Error("Phản hồi backend không hợp lệ (không phải JSON)");
            }
        } catch (error: any) {
            console.error("create error:", error.message);
            throw error;
        }
    },

    async update(id: string, data: UpdatePayrollData, sendEmail: boolean = true) {
        try {
            const queryParam = sendEmail ? "" : "?sendEmail=false";
            const res = await fetch(`${BASE_URL}/${id}${queryParam}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    ...getAuthHeaderClient(),
                },
                body: JSON.stringify(data),
            });
            const text = await res.text();
            if (!res.ok) throw new Error(`Lỗi khi cập nhật bảng lương: ${text}`);
            return JSON.parse(text);
        } catch (error: any) {
            console.error("update error:", error.message);
            throw error;
        }
    },

    async delete(id: string) {
        try {
            const res = await fetch(`${BASE_URL}/${id}`, {
                method: "DELETE",
                headers: getAuthHeaderClient(),
            });
            const text = await res.text();
            if (!res.ok) throw new Error(`Lỗi khi xóa bảng lương: ${text}`);
            return JSON.parse(text);
        } catch (error: any) {
            console.error("delete error:", error.message);
            throw error;
        }
    },

    async sendPayrollToEmployee(employeeId: string) {
        try {
            const res = await fetch(`${BASE_URL}/send/${employeeId}`, {
                method: "POST",
                headers: getAuthHeaderClient(),
            });
            const text = await res.text();
            if (!res.ok) throw new Error(`Lỗi khi gửi email: ${text}`);
            return JSON.parse(text);
        } catch (error: any) {
            console.error("sendPayrollToEmployee error:", error.message);
            throw error;
        }
    },

    async sendPayrollBulk(employeeIds: string[]) {
        try {
            const res = await fetch(`${BASE_URL}/send/bulk`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...getAuthHeaderClient(),
                },
                body: JSON.stringify({ employee_ids: employeeIds }),
            });
            const text = await res.text();
            if (!res.ok) throw new Error(`Lỗi khi gửi email hàng loạt: ${text}`);
            return JSON.parse(text);
        } catch (error: any) {
            console.error("sendPayrollBulk error:", error.message);
            throw error;
        }
    },

    async getByEmployeeId(employeeId: string) {
        try {
            const allPayrolls = await this.getAll();
            return allPayrolls.filter(
                (p: Payroll) =>
                    (typeof p.employee_id === "string"
                        ? p.employee_id
                        : p.employee_id._id) === employeeId && !p.disabled
            );
        } catch (error: any) {
            console.error("getByEmployeeId error:", error.message);
            throw error;
        }
    },
};

export default PayrollService;

