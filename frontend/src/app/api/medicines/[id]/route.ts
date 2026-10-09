// KẾ THỪA
import { NextRequest } from "next/server";
import { getSearch, proxyToBackend, proxyWithJsonBody } from "@/lib/backendProxy";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
    const { id } = await params;
    return proxyToBackend({
        path: `/api/medicines/${encodeURIComponent(id)}`,
        errorMessage: "Không tìm thấy thuốc",
    });
}

export async function PUT(req: NextRequest, { params }: Params) {
    const { id } = await params;
    return proxyWithJsonBody(req, {
        path: `/api/medicines/${encodeURIComponent(id)}`,
        method: "PUT",
        errorMessage: "Không thể cập nhật thuốc",
    });
}

// Chuyển tiếp ?hard=true (xóa vĩnh viễn); không có query là xóa mềm
export async function DELETE(req: NextRequest, { params }: Params) {
    const { id } = await params;
    return proxyToBackend({
        path: `/api/medicines/${encodeURIComponent(id)}`,
        method: "DELETE",
        search: getSearch(req),
        errorMessage: "Không thể xóa thuốc",
    });
}
