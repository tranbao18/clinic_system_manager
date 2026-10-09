// KẾ THỪA
import { NextRequest } from "next/server";
import { proxyToBackend } from "@/lib/backendProxy";

// Lưu ý: endpoint này gửi bảng lương THÁNG HIỆN TẠI của nhân viên.
// Giao diện dùng /api/payrolls/send/payroll/[id] để gửi đúng bảng lương được chọn.
export async function POST(
    _req: NextRequest,
    { params }: { params: Promise<{ employee_id: string }> }
) {
    const { employee_id } = await params;
    return proxyToBackend({
        path: `/api/payrolls/send/${encodeURIComponent(employee_id)}`,
        method: "POST",
        errorMessage: "Không thể gửi email bảng lương",
    });
}
