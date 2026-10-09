import { getAuthHeaderClient, handleAuthRedirect } from "@/lib/authHeaderClient";
export interface Medicine {
    _id: string;
    name: string;
    category: string[];
    unit: string;
    price: number;
    total_remaining?: number; // Tổng số lượng còn lại từ medicine-imports
    created_at: string;
    updated_at: string;
    disabled?: boolean;
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

export async function getMedicines(): Promise<Medicine[]> {
    const res = await fetch("/api/medicines", {
        cache: "no-store",
        headers: getAuthHeaderClient()
    });
    const data = await parseResponse<unknown>(res, "Không thể tải danh sách thuốc");
    return Array.isArray(data) ? data : [];
}

export async function getMedicineById(id: string): Promise<Medicine> {
    const res = await fetch(`/api/medicines/${id}`, {
        cache: "no-store",
        headers: getAuthHeaderClient()
    });
    return parseResponse<Medicine>(res, "Không thể lấy thông tin thuốc");
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
    return parseResponse<Medicine>(res, "Không thể tạo thuốc");
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
    return parseResponse<Medicine>(res, "Không thể cập nhật thuốc");
}

export async function deleteMedicine(id: string): Promise<void> {
    const res = await fetch(`/api/medicines/${id}`, {
        method: "DELETE",
        headers: getAuthHeaderClient()
    });
    await parseResponse<unknown>(res, "Không thể xóa thuốc");
}

export async function getDisabledMedicines(): Promise<Medicine[]> {
    const res = await fetch("/api/medicines?disabled=true", {
        cache: "no-store",
        headers: getAuthHeaderClient()
    });
    const data = await parseResponse<unknown>(res, "Không thể lấy danh sách thuốc đã xóa");
    // Chỉ giữ thuốc đã xóa để thao tác "Xóa vĩnh viễn" không bao giờ áp dụng cho thuốc đang dùng
    return (Array.isArray(data) ? (data as Medicine[]) : []).filter((m) => m.disabled === true);
}

export async function restoreMedicine(id: string): Promise<void> {
    const res = await fetch(`/api/medicines/${id}/restore`, {
        method: "PUT",
        headers: getAuthHeaderClient(),
    });
    await parseResponse<unknown>(res, "Không thể khôi phục thuốc");
}

export async function hardDeleteMedicine(id: string): Promise<void> {
    const res = await fetch(`/api/medicines/${id}?hard=true`, {
        method: "DELETE",
        headers: getAuthHeaderClient(),
    });
    await parseResponse<unknown>(res, "Không thể xóa vĩnh viễn thuốc");
}

export async function hardDeleteMedicines(ids: string[]): Promise<void> {
    const res = await fetch(`/api/medicines/bulk-delete?hard=true`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...getAuthHeaderClient(),
        },
        body: JSON.stringify({ ids }),
    });
    await parseResponse<unknown>(res, "Không thể xóa vĩnh viễn các thuốc");
}
