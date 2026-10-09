// KẾ THỪA
import { NextRequest } from "next/server";
import { getSearch, proxyToBackend, proxyWithJsonBody } from "@/lib/backendProxy";

// Chuyển tiếp query (vd: ?disabled=true cho Thùng rác)
export async function GET(req: NextRequest) {
    return proxyToBackend({
        path: "/api/medicine-imports",
        search: getSearch(req),
        errorMessage: "Không thể lấy danh sách nhập thuốc",
        transform: (data) =>
            Array.isArray(data) ? data : ((data as { medicineImports?: unknown[] } | null)?.medicineImports ?? []),
    });
}

export async function POST(req: NextRequest) {
    return proxyWithJsonBody(req, {
        path: "/api/medicine-imports",
        method: "POST",
        errorMessage: "Không thể tạo nhập thuốc",
    });
}
