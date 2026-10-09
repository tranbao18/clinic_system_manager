// KẾ THỪA
import { NextRequest } from "next/server";
import { getSearch, proxyToBackend, proxyWithJsonBody, toArray } from "@/lib/backendProxy";

// Chuyển tiếp query (vd: ?disabled=true cho Thùng rác) và giữ nguyên status lỗi của backend
export async function GET(req: NextRequest) {
    return proxyToBackend({
        path: "/api/invoices",
        search: getSearch(req),
        errorMessage: "Không thể lấy danh sách hóa đơn",
        transform: toArray,
    });
}

export async function POST(req: NextRequest) {
    return proxyWithJsonBody(req, {
        path: "/api/invoices",
        method: "POST",
        errorMessage: "Không thể tạo hóa đơn",
    });
}
