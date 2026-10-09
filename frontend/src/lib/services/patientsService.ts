import { getAuthHeaderClient } from "@/lib/authHeaderClient";

export interface Patient {
    _id: string;
    fullname: string;
    dob: string; // ISO date string
    gender: string; // "Nam" | "Nữ"
    address: string;
    phone: string;
    email: string;
    medical_history: {
        khoa: string;
        description: string;
    }[];
    created_at: string;
    updated_at: string;
}

// Đọc body lỗi một lần, ưu tiên thông điệp từ backend
async function buildError(res: Response, fallback: string): Promise<Error> {
    let message = fallback;
    try {
        const text = await res.text();
        const body = text ? JSON.parse(text) : null;
        if (body && typeof body === "object") message = body.error || body.message || fallback;
    } catch {
        // body không phải JSON, giữ thông điệp mặc định
    }
    const err = new Error(message);
    (err as any).status = res.status;
    return err;
}

export async function getPatients(): Promise<Patient[]> {
    const res = await fetch("/api/patients", {
        cache: "no-store",
        headers: getAuthHeaderClient()
    });
    if (!res.ok) throw await buildError(res, "Không thể lấy danh sách bệnh nhân");
    return res.json();
}

export async function getPatientById(id: string): Promise<Patient> {
    const res = await fetch(`/api/patients/${id}`, {
        cache: "no-store",
        headers: getAuthHeaderClient()
    });
    if (!res.ok) throw await buildError(res, "Không thể lấy thông tin bệnh nhân");
    return res.json();
}

export async function createPatient(data: Partial<Patient>): Promise<Patient> {
    const res = await fetch("/api/patients", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...getAuthHeaderClient()
        },
        body: JSON.stringify(data),
    });
    if (!res.ok) throw await buildError(res, "Không thể tạo bệnh nhân");
    return res.json();
}

export async function updatePatient(
    id: string,
    data: Partial<Patient>
): Promise<Patient> {
    const res = await fetch(`/api/patients/${id}`, {
        method: "PUT", // backend của bạn dùng PUT
        headers: {
            "Content-Type": "application/json",
            ...getAuthHeaderClient()
        },
        body: JSON.stringify(data),
    });
    if (!res.ok) throw await buildError(res, "Không thể cập nhật bệnh nhân");
    return res.json();
}

export async function deletePatient(id: string, permanent = false): Promise<void> {
    const url = `/api/patients/${id}` + (permanent ? "?hard=true" : "");
    const res = await fetch(url, {
        method: "DELETE",
        headers: getAuthHeaderClient()
    });
    if (!res.ok) throw await buildError(res, "Không thể xóa bệnh nhân");
}

export async function getDisabledPatients(): Promise<Patient[]> {
    const res = await fetch("/api/patients?disabled=true", {
        cache: "no-store",
        headers: getAuthHeaderClient()
    });
    if (!res.ok) throw await buildError(res, "Không thể lấy danh sách bệnh nhân đã xóa");
    return res.json();
}

export async function restorePatient(id: string): Promise<Patient> {
    const res = await fetch(`/api/patients/${id}/restore`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            ...getAuthHeaderClient()
        },
    });
    if (!res.ok) throw await buildError(res, "Không thể khôi phục bệnh nhân");
    return res.json();
}
