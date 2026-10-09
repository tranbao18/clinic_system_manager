// KẾ THỪA
import { NextRequest } from "next/server";
import { getSearch, proxyToBackend, proxyWithJsonBody } from "@/lib/backendProxy";

// Chuyển tiếp query (vd: ?disabled=true cho Thùng rác)
export async function GET(req: NextRequest) {
    return proxyToBackend({
        path: "/api/medicines",
        search: getSearch(req),
        errorMessage: "Không thể lấy danh sách thuốc",
        transform: (data) =>
            Array.isArray(data) ? data : ((data as { medicines?: unknown[] } | null)?.medicines ?? []),
    });
}

export async function POST(req: NextRequest) {
    return proxyWithJsonBody(req, {
        path: "/api/medicines",
        method: "POST",
        errorMessage: "Không thể tạo thuốc",
    });
}
