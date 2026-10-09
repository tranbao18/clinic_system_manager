// KẾ THỪA
import { NextRequest } from "next/server";
import { getSearch, proxyToBackend, proxyWithJsonBody } from "@/lib/backendProxy";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
    const { id } = await params;
    return proxyToBackend({
        path: `/api/medicine-imports/${encodeURIComponent(id)}`,
        errorMessage: "Không tìm thấy nhập thuốc",
    });
}

export async function PUT(req: NextRequest, { params }: Params) {
    const { id } = await params;
    return proxyWithJsonBody(req, {
        path: `/api/medicine-imports/${encodeURIComponent(id)}`,
        method: "PUT",
        errorMessage: "Không thể cập nhật nhập thuốc",
    });
}

export async function DELETE(req: NextRequest, { params }: Params) {
    const { id } = await params;
    return proxyToBackend({
        path: `/api/medicine-imports/${encodeURIComponent(id)}`,
        method: "DELETE",
        search: getSearch(req),
        errorMessage: "Không thể xóa nhập thuốc",
    });
}
