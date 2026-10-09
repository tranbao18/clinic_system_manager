export interface ShiftSchedule {
    employee_id: string;
    employee_name: string;
    employee_position?: string; // Position của nhân viên
    shift_schedule: any; // Mixed type - có thể là object, array, hoặc bất kỳ cấu trúc nào
}

export interface CreateScheduleInput {
    employee_id: string;
    shift_schedule: any;
}

import { getSafeAuthHeaders } from "@/lib/authHeaderClient";

async function getSafeHeaders() {
    return getSafeAuthHeaders();
}

// Đọc body lỗi một lần; body không phải JSON vẫn ra thông báo dễ hiểu
async function buildError(res: Response, fallback: string): Promise<Error> {
    let message = fallback;
    try {
        const text = await res.text();
        const body = text ? JSON.parse(text) : null;
        if (body && typeof body === "object") message = body.error || body.message || fallback;
    } catch {
        // giữ thông báo mặc định
    }
    const err = new Error(message);
    (err as any).status = res.status;
    return err;
}

const SchedulesService = {
    async getAll(): Promise<ShiftSchedule[]> {
        try {
            const headers = await getSafeHeaders();
            const res = await fetch("/api/schedules", {
                cache: "no-store",
                headers,
            });

            if (!res.ok) {
                throw new Error(`Failed to fetch schedules: ${res.status}`);
            }

            const data = await res.json();
            return Array.isArray(data) ? data : [data];
        } catch (error: any) {
            console.error("❌ getSchedules errors:", error?.message || error);
            return [];
        }
    },

    async getByEmployeeId(employee_id: string): Promise<ShiftSchedule | null> {
        try {
            const headers = await getSafeHeaders();
            const res = await fetch(`/api/schedules/${employee_id}`, {
                cache: "no-store",
                headers,
            });

            if (!res.ok) {
                throw new Error(`Failed to fetch schedule: ${res.status}`);
            }

            const data = await res.json();
            return Array.isArray(data) ? data[0] : data;
        } catch (error: any) {
            console.error("❌ getScheduleByEmployeeId errors:", error?.message || error);
            return null;
        }
    },

    async create(input: CreateScheduleInput): Promise<ShiftSchedule> {
        try {
            const headers = await getSafeHeaders();
            const res = await fetch("/api/schedules", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...headers,
                },
                body: JSON.stringify(input),
                cache: "no-store",
            });

            if (!res.ok) {
                throw await buildError(res, "Không thể tạo lịch trực");
            }

            return await res.json();
        } catch (error: any) {
            console.error("❌ createSchedule errors:", error?.message || error);
            throw error;
        }
    },

    async update(employee_id: string, shift_schedule: any): Promise<ShiftSchedule> {
        try {
            const headers = await getSafeHeaders();
            const res = await fetch(`/api/schedules/${employee_id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    ...headers,
                },
                body: JSON.stringify({ shift_schedule }),
                cache: "no-store",
            });

            if (!res.ok) {
                throw await buildError(res, "Không thể cập nhật lịch trực");
            }

            return await res.json();
        } catch (error: any) {
            console.error("❌ updateSchedule errors:", error?.message || error);
            throw error;
        }
    },

    async delete(employee_id: string): Promise<void> {
        try {
            const headers = await getSafeHeaders();
            const res = await fetch(`/api/schedules/${employee_id}`, {
                method: "DELETE",
                headers,
                cache: "no-store",
            });

            if (!res.ok) {
                throw await buildError(res, "Không thể xóa lịch trực");
            }
        } catch (error: any) {
            console.error("❌ deleteSchedule errors:", error?.message || error);
            throw error;
        }
    },
};

export default SchedulesService;

