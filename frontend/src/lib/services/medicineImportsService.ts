import { getAuthHeaderClient } from "@/lib/authHeaderClient";
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
}

export interface CreateMedicineImportData {
    medicine_id: string;
    supplier: string;
    batchcode: string;
    quantity: number;
    unit_price: number;
    expiry_date: string;
    import_date: string;
    imported_by: string;
}

export interface UpdateMedicineImportData {
    remaining?: number;
}

export async function getMedicineImports(): Promise<MedicineImport[]> {
    try {
        const res = await fetch("/api/medicine-imports", {
            cache: "no-store",
            headers: getAuthHeaderClient()
        });
        if (!res.ok) {
            throw new Error(`Failed to fetch medicine imports: ${res.status}`);
        }
        const data = await res.json();
        return Array.isArray(data) ? data : [];
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("❌ getMedicineImports errors:", errorMessage);
        return [];
    }
}

export async function getMedicineImportById(id: string): Promise<MedicineImport> {
    const res = await fetch(`/api/medicine-imports/${id}`, {
        cache: "no-store",
        headers: getAuthHeaderClient()
    });
    if (!res.ok) throw new Error("Không thể lấy thông tin nhập thuốc");
    return res.json();
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
    if (!res.ok) {
        const error = await res.json().catch(() => ({ error: "Không thể tạo nhập thuốc" }));
        throw new Error(error.error || "Không thể tạo nhập thuốc");
    }
    return res.json();
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
    if (!res.ok) {
        const error = await res.json().catch(() => ({ error: "Không thể cập nhật nhập thuốc" }));
        throw new Error(error.error || "Không thể cập nhật nhập thuốc");
    }
    return res.json();
}

export async function deleteMedicineImport(id: string): Promise<void> {
    const res = await fetch(`/api/medicine-imports/${id}`, {
        method: "DELETE",
        headers: getAuthHeaderClient()
    });
    if (!res.ok) {
        const error = await res.json().catch(() => ({ error: "Không thể xóa nhập thuốc" }));
        throw new Error(error.error || "Không thể xóa nhập thuốc");
    }
}

export async function getDisabledMedicineImports(): Promise<MedicineImport[]> {
    const res = await fetch("/api/medicine-imports?disabled=true", {
        cache: "no-store",
        headers: getAuthHeaderClient()
    });
    if (!res.ok) {
        const error = await res.json().catch(() => ({ error: "Không thể lấy danh sách nhập thuốc đã xóa" }));
        throw new Error(error.error || "Không thể lấy danh sách nhập thuốc đã xóa");
    }
    return res.json();
}

export async function restoreMedicineImport(id: string): Promise<MedicineImport> {
    const res = await fetch(`/api/medicine-imports/${id}/restore`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            ...getAuthHeaderClient()
        },
    });
    if (!res.ok) {
        const error = await res.json().catch(() => ({ error: "Không thể khôi phục nhập thuốc" }));
        throw new Error(error.error || "Không thể khôi phục nhập thuốc");
    }
    return res.json();
}

