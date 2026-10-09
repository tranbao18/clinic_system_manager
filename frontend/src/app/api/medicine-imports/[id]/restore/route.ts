import { NextRequest } from "next/server";
import { proxyToBackend } from "@/lib/backendProxy";

// Khôi phục phiếu nhập thuốc từ Thùng rác (Admin)
export async function PUT(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return proxyToBackend({
        path: `/api/medicine-imports/${encodeURIComponent(id)}/restore`,
        method: "PUT",
        errorMessage: "Không thể khôi phục nhập thuốc",
    });
}
