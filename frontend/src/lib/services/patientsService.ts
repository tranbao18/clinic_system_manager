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

export async function getPatients(): Promise<Patient[]> {
    const res = await fetch("/api/patients", {
        cache: "no-store",
        headers: getAuthHeaderClient()
    });
    if (!res.ok) throw new Error("Không thể lấy danh sách bệnh nhân");
    return res.json();
}

export async function getPatientById(id: string): Promise<Patient> {
    const res = await fetch(`/api/patients/${id}`, {
        cache: "no-store",
        headers: getAuthHeaderClient()
    });
    if (!res.ok) throw new Error("Không thể lấy thông tin bệnh nhân");
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
    if (!res.ok) throw new Error("Không thể tạo bệnh nhân");
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
    if (!res.ok) throw new Error("Không thể cập nhật bệnh nhân");
    return res.json();
}

export async function deletePatient(id: string, permanent = false): Promise<void> {
    const url = `/api/patients/${id}` + (permanent ? "?hard=true" : "");
    const res = await fetch(url, {
        method: "DELETE",
        headers: getAuthHeaderClient()
    });
    if (!res.ok) throw new Error("Không thể xóa bệnh nhân");
}

export async function getDisabledPatients(): Promise<Patient[]> {
    const res = await fetch("/api/patients?disabled=true", {
        cache: "no-store",
        headers: getAuthHeaderClient()
    });
    if (!res.ok) throw new Error("Không thể lấy danh sách bệnh nhân đã xóa");
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
    if (!res.ok) throw new Error("Không thể khôi phục bệnh nhân");
    return res.json();
}
