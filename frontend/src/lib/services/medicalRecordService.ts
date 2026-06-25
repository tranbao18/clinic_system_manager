import { getAuthHeaderClient } from "@/lib/authHeaderClient";

export interface Prescription {
    medicine_id: string | { _id: string; name: string; unit: string; price: number };
    quantity: number;
    dosage: string;
}

export interface MedicalRecord {
    _id: string;
    appointment_id?: string | { _id: string };
    patient_id: string | { _id: string };
    doctor_id: string | { _id: string; fullname?: string };
    diagnosis: string;
    treatment?: string;
    prescriptions: Prescription[];
    notes?: string;
    created_at: string;
    updated_at: string;
}

export async function getMedicalRecords(): Promise<MedicalRecord[]> {
    const res = await fetch("/api/medical-records", {
        cache: "no-store",
        headers: (getAuthHeaderClient() as Record<string, string>)
    });
    if (!res.ok) throw new Error("Không thể lấy danh sách hồ sơ y tế");
    return res.json();
}

export async function getMedicalRecordsByPatientId(patientId: string): Promise<MedicalRecord[]> {
    const headers = (getAuthHeaderClient() as Record<string, string>);
    try { console.debug("🔁 getMedicalRecordsByPatientId headers:", headers); } catch (e) { }

    const res = await fetch(`/api/medical-records/patient/${patientId}`, {
        cache: "no-store",
        headers
    });

    if (!res.ok) {
        let bodyText = "";
        try { bodyText = await res.text(); } catch (e) { }
        console.error("getMedicalRecordsByPatientId failed:", { status: res.status, body: bodyText });
        if (res.status === 401 || res.status === 403) {
            throw new Error("Bạn không có quyền xem hồ sơ y tế hoặc phiên đã hết hạn");
        }
        throw new Error("Không thể lấy hồ sơ y tế");
    }
    return res.json();
}

export async function getMedicalRecordById(id: string): Promise<MedicalRecord> {
    const res = await fetch(`/api/medical-records/${id}`, {
        cache: "no-store",
        headers: (getAuthHeaderClient() as Record<string, string>)
    });
    if (!res.ok) throw new Error("Không thể lấy thông tin hồ sơ y tế");
    return res.json();
}

export async function createMedicalRecord(data: Partial<MedicalRecord>): Promise<MedicalRecord> {
    const headers = {
        "Content-Type": "application/json",
        ...(getAuthHeaderClient() as Record<string, string>)
    };
    // Debug: log payload and headers to help troubleshoot server rejections
    try {
        console.debug("🔁 createMedicalRecord payload:", { data, headers });
    } catch (e) { }

    const res = await fetch("/api/medical-records", {
        method: "POST",
        headers: {
            ...headers
        },
        body: JSON.stringify(data),
    });
    if (!res.ok) {
        // Try to extract server error details for better debugging
        let errMsg = `Không thể tạo hồ sơ y tế (status ${res.status})`;
        try {
            const text = await res.text().catch(() => "");
            let body = null;
            if (text) {
                try {
                    body = JSON.parse(text);
                } catch {
                    body = null;
                }
            }

            if (body && typeof body === "object" && Object.keys(body).length > 0) {
                errMsg = body.error || body.message || JSON.stringify(body);
            } else if (text) {
                errMsg = text;
            }
        } catch (e) {
            // ignore parsing errors
        }
        console.error("createMedicalRecord failed:", { status: res.status, message: errMsg, payload: data });
        // If unauthorized, surface a clearer message
        if (res.status === 401 || res.status === 403) {
            throw new Error("Bạn không có quyền tạo hồ sơ y tế hoặc phiên đã hết hạn");
        }
        throw new Error(errMsg);
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
    if (!res.ok) throw new Error("Không thể cập nhật hồ sơ y tế");
    return res.json();
}

export async function deleteMedicalRecord(id: string, permanent = false): Promise<void> {
    const url = `/api/medical-records/${id}` + (permanent ? "?hard=true" : "");
    const res = await fetch(url, {
        method: "DELETE",
        headers: (getAuthHeaderClient() as Record<string, string>)
    });
    if (!res.ok) {
        const error = await res.json().catch(() => ({ error: "Không thể xóa hồ sơ y tế" }));
        throw new Error(error.error || error.message || "Không thể xóa hồ sơ y tế");
    }
}

export async function getDisabledMedicalRecords(): Promise<MedicalRecord[]> {
    const res = await fetch("/api/medical-records?disabled=true", {
        cache: "no-store",
        headers: (getAuthHeaderClient() as Record<string, string>)
    });
    if (!res.ok) throw new Error("Không thể lấy danh sách hồ sơ y tế đã xóa");
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

export async function restoreMedicalRecord(id: string): Promise<MedicalRecord> {
    const res = await fetch(`/api/medical-records/${id}/restore`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            ...(getAuthHeaderClient() as Record<string, string>)
        },
    });
    if (!res.ok) throw new Error("Không thể khôi phục hồ sơ y tế");
    return res.json();
}

