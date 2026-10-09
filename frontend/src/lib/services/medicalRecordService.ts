import { getAuthHeaderClient } from "@/lib/authHeaderClient";

export interface Prescription {
    medicine_id: string | { _id: string; name: string; unit: string; price: number } | null;
    quantity: number;
    dosage: string;
}

export interface MedicalRecord {
    _id: string;
    appointment_id?: string | { _id: string; appointment_date?: string } | null;
    patient_id: string | { _id: string; fullname?: string } | null;
    // null khi bác sĩ không còn tồn tại (vd: hồ sơ do Admin tạo)
    doctor_id: string | { _id: string; fullname?: string } | null;
    diagnosis: string;
    treatment?: string;
    prescriptions: Prescription[];
    notes?: string;
    created_at: string;
    updated_at: string;
}

// Đọc body lỗi một lần, ưu tiên thông điệp từ backend; gắn status để trang xử lý riêng (403...)
async function buildError(res: Response, fallback: string): Promise<Error> {
    let text = "";
    try {
        text = await res.text();
    } catch {
        // ignore
    }
    let body: any = null;
    if (text) {
        try {
            body = JSON.parse(text);
        } catch {
            body = null;
        }
    }
    let message = (body && typeof body === "object" && (body.error || body.message)) || fallback;
    if (res.status === 401) {
        message = "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
    } else if (res.status === 403 && !(body && (body.error || body.message))) {
        message = "Bạn không có quyền thực hiện thao tác này";
    }
    const err = new Error(message);
    (err as any).status = res.status;
    (err as any).body = body;
    return err;
}

export async function getMedicalRecords(): Promise<MedicalRecord[]> {
    const res = await fetch("/api/medical-records", {
        cache: "no-store",
        headers: (getAuthHeaderClient() as Record<string, string>)
    });
    if (!res.ok) throw await buildError(res, "Không thể lấy danh sách hồ sơ y tế");
    return res.json();
}

export async function getMedicalRecordsByPatientId(patientId: string): Promise<MedicalRecord[]> {
    const headers = (getAuthHeaderClient() as Record<string, string>);

    const res = await fetch(`/api/medical-records/patient/${patientId}`, {
        cache: "no-store",
        headers
    });

    if (!res.ok) {
        const err = await buildError(res, "Không thể lấy hồ sơ y tế");
        console.error("getMedicalRecordsByPatientId failed:", { status: res.status, message: err.message });
        throw err;
    }
    return res.json();
}

export async function getMedicalRecordById(id: string): Promise<MedicalRecord> {
    const res = await fetch(`/api/medical-records/${id}`, {
        cache: "no-store",
        headers: (getAuthHeaderClient() as Record<string, string>)
    });
    if (!res.ok) throw await buildError(res, "Không thể lấy thông tin hồ sơ y tế");
    return res.json();
}

export async function createMedicalRecord(data: Partial<MedicalRecord>): Promise<MedicalRecord> {
    const res = await fetch("/api/medical-records", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(getAuthHeaderClient() as Record<string, string>)
        },
        body: JSON.stringify(data),
    });
    if (!res.ok) {
        const err = await buildError(res, `Không thể tạo hồ sơ y tế (status ${res.status})`);
        console.error("createMedicalRecord failed:", { status: res.status, message: err.message });
        throw err;
    }
    return res.json();
}

export async function updateMedicalRecord(
    id: string,
    data: Partial<MedicalRecord>
): Promise<MedicalRecord> {
    const res = await fetch(`/api/medical-records/${id}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            ...(getAuthHeaderClient() as Record<string, string>)
        },
        body: JSON.stringify(data),
    });
    if (!res.ok) throw await buildError(res, "Không thể cập nhật hồ sơ y tế");
    return res.json();
}

// permanent=true (xóa vĩnh viễn) chỉ Admin được phép
export async function deleteMedicalRecord(id: string, permanent = false): Promise<void> {
    const url = `/api/medical-records/${id}` + (permanent ? "?hard=true" : "");
    const res = await fetch(url, {
        method: "DELETE",
        headers: (getAuthHeaderClient() as Record<string, string>)
    });
    if (!res.ok) throw await buildError(res, "Không thể xóa hồ sơ y tế");
}

export async function getDisabledMedicalRecords(): Promise<MedicalRecord[]> {
    const res = await fetch("/api/medical-records?disabled=true", {
        cache: "no-store",
        headers: (getAuthHeaderClient() as Record<string, string>)
    });
    if (!res.ok) throw await buildError(res, "Không thể lấy danh sách hồ sơ y tế đã xóa");
    return res.json();
}

export async function getDisabledMedicalRecordsByPatientId(patientId: string): Promise<MedicalRecord[]> {
    try {
        const allDisabled = await getDisabledMedicalRecords();
        return allDisabled.filter((record) => {
            const recordPatientId = typeof record.patient_id === 'object' && record.patient_id
                ? (record.patient_id as any)._id
                : record.patient_id;
            return recordPatientId === patientId;
        });
    } catch (error: any) {
        console.error("getDisabledMedicalRecordsByPatientId error:", error);
        return [];
    }
}

// Backend chỉ cho Admin khôi phục
export async function restoreMedicalRecord(id: string): Promise<{ message?: string }> {
    const res = await fetch(`/api/medical-records/${id}/restore`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            ...(getAuthHeaderClient() as Record<string, string>)
        },
    });
    if (!res.ok) throw await buildError(res, "Không thể khôi phục hồ sơ y tế");
    return res.json();
}
