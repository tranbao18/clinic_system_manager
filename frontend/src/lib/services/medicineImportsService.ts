import { getAuthHeaderClient, handleAuthRedirect } from "@/lib/authHeaderClient";
export interface MedicineImport {
    _id: string;
    medicine_id: string | {
        _id: string;
        name: string;
        category: string[];
        unit: string;
        price: number;
    };
    supplier: string;
    batchcode: string;
    quantity: number;
    remaining: number;
    unit_price: number;
    expiry_date: string;
    import_date: string;
    imported_by: string | {
        _id: string;
        fullname: string;
    };
    updated_at: string;
    disabled?: boolean;
}

export interface CreateMedicineImportData {
    medicine_id: string;
    supplier: string;
    batchcode: string;
    quantity: number;
    unit_price: number;
    /** Ngày dạng YYYY-MM-DD */
    expiry_date: string;
    /** Ngày dạng YYYY-MM-DD */
    import_date: string;
    imported_by: string;
}

export interface UpdateMedicineImportData {
    remaining?: number;
}

// Đọc body một lần; lỗi thì ném Error kèm thông báo backend; 401 chuyển về trang đăng nhập
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

export async function getMedicineImports(): Promise<MedicineImport[]> {
    const res = await fetch("/api/medicine-imports", {
        cache: "no-store",
        headers: getAuthHeaderClient()
    });
    const data = await parseResponse<unknown>(res, "Không thể tải danh sách nhập thuốc");
    return Array.isArray(data) ? data : [];
}

export async function getMedicineImportById(id: string): Promise<MedicineImport> {
    const res = await fetch(`/api/medicine-imports/${id}`, {
        cache: "no-store",
        headers: getAuthHeaderClient()
    });
    return parseResponse<MedicineImport>(res, "Không thể lấy thông tin nhập thuốc");
}

export async function createMedicineImport(data: CreateMedicineImportData): Promise<MedicineImport> {
    const res = await fetch("/api/medicine-imports", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...getAuthHeaderClient()
        },
        body: JSON.stringify(data),
    });
    return parseResponse<MedicineImport>(res, "Không thể tạo nhập thuốc");
}

export async function updateMedicineImport(
    id: string,
    data: UpdateMedicineImportData
): Promise<MedicineImport> {
    const res = await fetch(`/api/medicine-imports/${id}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            ...getAuthHeaderClient()
        },
        body: JSON.stringify(data),
    });
    return parseResponse<MedicineImport>(res, "Không thể cập nhật nhập thuốc");
}

export async function deleteMedicineImport(id: string): Promise<void> {
    const res = await fetch(`/api/medicine-imports/${id}`, {
        method: "DELETE",
        headers: getAuthHeaderClient()
    });
    await parseResponse<unknown>(res, "Không thể xóa nhập thuốc");
}

export async function getDisabledMedicineImports(): Promise<MedicineImport[]> {
    const res = await fetch("/api/medicine-imports?disabled=true", {
        cache: "no-store",
        headers: getAuthHeaderClient()
    });
    const data = await parseResponse<unknown>(res, "Không thể lấy danh sách nhập thuốc đã xóa");
    return (Array.isArray(data) ? (data as MedicineImport[]) : []).filter((i) => i.disabled === true);
}

export async function restoreMedicineImport(id: string): Promise<void> {
    const res = await fetch(`/api/medicine-imports/${id}/restore`, {
        method: "PUT",
        headers: getAuthHeaderClient(),
    });
    await parseResponse<unknown>(res, "Không thể khôi phục nhập thuốc");
}
