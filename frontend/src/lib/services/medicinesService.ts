import { getAuthHeaderClient } from "@/lib/authHeaderClient";
export interface Medicine {
    _id: string;
    name: string;
    category: string[];
    unit: string;
    price: number;
    total_remaining?: number; // Tổng số lượng còn lại từ medicine-imports
    created_at: string;
    updated_at: string;
}

export interface CreateMedicineData {
    name: string;
    category: string[];
    unit: string;
    price: number;
}

export interface UpdateMedicineData {
    name?: string;
    category?: string[];
    unit?: string;
    price?: number;
}

export const MEDICINE_CATEGORIES = [
    "Kháng sinh",
    "Giảm đau",
    "Hạ sốt",
    "Kháng viêm",
    "Vitamin",
    "Khoáng chất",
    "Tim mạch",
    "Tiêu hóa",
    "Hô hấp",
    "Da liễu",
    "Thuốc mắt",
    "Tai mũi họng",
    "Thần kinh",
    "Nội tiết",
    "Khác",
] as const;

export async function getMedicines(): Promise<Medicine[]> {
    try {
        const res = await fetch("/api/medicines", {
            cache: "no-store",
            headers: getAuthHeaderClient()
        });
        if (!res.ok) {
            throw new Error(`Failed to fetch medicines: ${res.status}`);
        }
        const data = await res.json();
        return Array.isArray(data) ? data : [];
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("❌ getMedicines errors:", errorMessage);
        return [];
    }
}

export async function getMedicineById(id: string): Promise<Medicine> {
    const res = await fetch(`/api/medicines/${id}`, {
        cache: "no-store",
        headers: getAuthHeaderClient()
    });
    if (!res.ok) throw new Error("Không thể lấy thông tin thuốc");
    return res.json();
}

export async function createMedicine(data: CreateMedicineData): Promise<Medicine> {
    const res = await fetch("/api/medicines", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...getAuthHeaderClient()
        },
        body: JSON.stringify(data),
    });
    if (!res.ok) {
        const error = await res.json().catch(() => ({ error: "Không thể tạo thuốc" }));
        throw new Error(error.error || "Không thể tạo thuốc");
    }
    return res.json();
}

export async function updateMedicine(
    id: string,
    data: UpdateMedicineData
): Promise<Medicine> {
    const res = await fetch(`/api/medicines/${id}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            ...getAuthHeaderClient()
        },
        body: JSON.stringify(data),
    });
    if (!res.ok) {
        const error = await res.json().catch(() => ({ error: "Không thể cập nhật thuốc" }));
        throw new Error(error.error || "Không thể cập nhật thuốc");
    }
    return res.json();
}

export async function deleteMedicine(id: string): Promise<void> {
    const res = await fetch(`/api/medicines/${id}`, {
        method: "DELETE",
        headers: getAuthHeaderClient()
    });
    if (!res.ok) {
        const error = await res.json().catch(() => ({ error: "Không thể xóa thuốc" }));
        throw new Error(error.error || "Không thể xóa thuốc");
    }
}

export async function getDisabledMedicines(): Promise<Medicine[]> {
    const res = await fetch("/api/medicines?disabled=true", {
        cache: "no-store",
        headers: getAuthHeaderClient()
    });
    if (!res.ok) {
        const error = await res.json().catch(() => ({ error: "Không thể lấy danh sách thuốc đã xóa" }));
        throw new Error(error.error || "Không thể lấy danh sách thuốc đã xóa");
    }
    return res.json();
}

export async function restoreMedicine(id: string): Promise<Medicine> {
    const res = await fetch(`/api/medicines/${id}/restore`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            ...getAuthHeaderClient()
        },
    });
    if (!res.ok) {
        const error = await res.json().catch(() => ({ error: "Không thể khôi phục thuốc" }));
        throw new Error(error.error || "Không thể khôi phục thuốc");
    }
    return res.json();
}

export async function hardDeleteMedicine(id: string): Promise<void> {
    const res = await fetch(`/api/medicines/${id}?hard=true`, { method: "DELETE" });
    if (!res.ok) {
        const error = await res.json().catch(() => ({ error: "Không thể xóa vĩnh viễn thuốc" }));
        throw new Error(error.error || "Không thể xóa vĩnh viễn thuốc");
    }
}

export async function hardDeleteMedicines(ids: string[]): Promise<void> {
    const res = await fetch(`/api/medicines/bulk-delete?hard=true`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
    });
    if (!res.ok) {
        const error = await res.json().catch(() => ({ error: "Không thể xóa vĩnh viễn các thuốc" }));
        throw new Error(error.error || "Không thể xóa vĩnh viễn các thuốc");
    }
}

