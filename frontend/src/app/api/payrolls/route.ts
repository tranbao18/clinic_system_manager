// KẾ THỪA
import { NextRequest } from "next/server";
import { proxyToBackend, proxyWithJsonBody, toArray } from "@/lib/backendProxy";

export async function GET() {
    return proxyToBackend({
        path: "/api/payrolls",
        errorMessage: "Không thể tải danh sách bảng lương",
        transform: toArray,
    });
}

// Lỗi nghiệp vụ (lương âm, trùng tháng) trả 400 kèm thông báo của backend
export async function POST(req: NextRequest) {
    return proxyWithJsonBody(req, {
        path: "/api/payrolls",
        method: "POST",
        errorMessage: "Không thể tạo bảng lương",
    });
}
