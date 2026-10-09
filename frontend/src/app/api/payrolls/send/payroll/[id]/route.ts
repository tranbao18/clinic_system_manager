import { NextRequest } from "next/server";
import { proxyToBackend } from "@/lib/backendProxy";

// Gửi email đúng bảng lương được chọn (theo payroll_id), không phải bảng lương tháng hiện tại
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return proxyToBackend({
        path: `/api/payrolls/send/payroll/${encodeURIComponent(id)}`,
        method: "POST",
        errorMessage: "Không thể gửi email bảng lương",
    });
}
