import { NextRequest } from "next/server";
import { getSearch, proxyToBackend, proxyWithJsonBody, toArray } from "@/lib/backendProxy";

export async function GET(req: NextRequest) {
    return proxyToBackend({
        path: "/api/payments",
        search: getSearch(req),
        errorMessage: "Không thể lấy danh sách thanh toán",
        transform: toArray,
    });
}

// Backend từ chối thanh toán vượt số còn lại (400 kèm thông báo) — giữ nguyên thông báo đó
export async function POST(req: NextRequest) {
    return proxyWithJsonBody(req, {
        path: "/api/payments",
        method: "POST",
        errorMessage: "Không thể tạo thanh toán",
    });
}
