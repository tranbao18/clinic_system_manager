import { getSafeAuthHeaders } from "@/lib/authHeaderClient";

type PopulatedRef = { _id: string; fullname?: string; position?: string };

export interface Appointment {
    _id: string;
    patient_id: string | PopulatedRef;
    doctor_id: string | PopulatedRef | null;
    appointment_date: string; // ISO string
    status: string;
    reason: string;
    disabled?: boolean;
    created_at: string;
    updated_at: string;
}

export interface CreateAppointmentData {
    patient_id: string;
    doctor_id: string;
    appointment_date: string; // ISO string
    status?: string;
    reason?: string;
}


export interface UpdateAppointmentData {
    patient_id?: string;
    doctor_id?: string;
    appointment_date?: string;
    status?: string;
    reason?: string;
}

/**
 * Lấy id dạng chuỗi từ giá trị có thể là id thuần hoặc document đã populate (hoặc null).
 */
export function toIdString(value: unknown): string {
    if (value === undefined || value === null) return "";
    if (typeof value === "string") return value;
    if (typeof value === "object") {
        const id = (value as { _id?: unknown })._id;
        if (id !== undefined && id !== null) return String(id);
        return "";
    }
    return String(value);
}

// Đọc body lỗi một lần, ưu tiên thông điệp từ backend
async function buildError(res: Response, fallback: string): Promise<Error> {
    let text = "";
    try {
        text = await res.text();
    } catch {
        // ignore
    }
    let message = fallback;
    if (text) {
        try {
            const body = JSON.parse(text);
            if (body && typeof body === "object") {
                message = body.error || body.message || fallback;
            }
        } catch {
            // body không phải JSON, giữ thông điệp mặc định
        }
    }
    const err = new Error(message);
    (err as any).status = res.status;
    return err;
}

export async function getAppointments(
    options: { includeDisabled?: boolean } = {}
): Promise<Appointment[]> {
    try {
        const headers = getSafeAuthHeaders() as Record<string, string>;
        const url = options.includeDisabled ? "/api/appointments" : "/api/appointments?disabled=false";

        const res = await fetch(url, {
            cache: "no-store",
            headers
        });
        if (!res.ok) {
            // try to extract response body for better debugging
            let bodyText = "";
            try {
                bodyText = await res.text();
            } catch (e) { }
            console.error("getAppointments failed:", { status: res.status, body: bodyText });
            throw new Error(`Failed to fetch appointments: ${res.status}`);
        }
        const data = await res.json();
        return Array.isArray(data) ? data : [];
    } catch (error: any) {
        console.error("❌ getAppointments errors:", error?.message || error);
        return [];
    }
}


export async function getAppointmentById(id: string): Promise<Appointment> {
    const res = await fetch(`/api/appointments/${id}`, {
        cache: "no-store",
        headers: getSafeAuthHeaders()
    });
    if (!res.ok) throw await buildError(res, "Không thể lấy thông tin lịch hẹn");
    return res.json();
}

export async function createAppointment(data: CreateAppointmentData): Promise<Appointment> {
    const res = await fetch("/api/appointments", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...getSafeAuthHeaders()
        },
        body: JSON.stringify(data),
    });
    if (!res.ok) throw await buildError(res, "Không thể tạo lịch hẹn");
    return res.json();
}

export async function updateAppointment(
    id: string,
    data: UpdateAppointmentData
): Promise<Appointment> {

    const res = await fetch(`/api/appointments/${id}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            ...getSafeAuthHeaders()
        },
        body: JSON.stringify(data),
    });
    if (!res.ok) throw await buildError(res, "Không thể cập nhật lịch hẹn");
    return res.json();
}

// Mặc định xóa mềm; chỉ Admin mới được xóa vĩnh viễn (hard)
export async function deleteAppointment(id: string, options: { hard?: boolean } = {}): Promise<void> {
    const url = `/api/appointments/${id}` + (options.hard ? "?hard=true" : "");

    const res = await fetch(url, {
        method: "DELETE",
        headers: getSafeAuthHeaders()
    });

    if (!res.ok) {
        const err = await buildError(res, "Không thể xóa lịch hẹn");
        console.error("❌ [DELETE APPOINTMENT] failed:", res.status, err.message);
        throw err;
    }
}
