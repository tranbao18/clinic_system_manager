// KẾ THỪA
import { NextRequest } from "next/server";
import { proxyWithJsonBody } from "@/lib/backendProxy";

// Lưu ý: endpoint này gửi bảng lương THÁNG HIỆN TẠI theo employee_ids.
// Giao diện dùng /api/payrolls/send/payroll/bulk ({ payroll_ids }) để gửi đúng các bảng lương được chọn.
export async function POST(req: NextRequest) {
    return proxyWithJsonBody(req, {
        path: "/api/payrolls/send/bulk",
        method: "POST",
        errorMessage: "Không thể gửi email bảng lương hàng loạt",
    });
}
