import { NextRequest } from "next/server";
import { getSearch, proxyWithJsonBody } from "@/lib/backendProxy";

// Body { ids: string[] }; ?hard=true để xóa vĩnh viễn (Admin)
export async function POST(req: NextRequest) {
    return proxyWithJsonBody(req, {
        path: "/api/medicines/bulk-delete",
        method: "POST",
        search: getSearch(req),
        errorMessage: "Không thể xóa các thuốc đã chọn",
    });
}
