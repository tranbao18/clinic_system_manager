import { NextRequest } from "next/server";
import { proxyToBackend, proxyWithJsonBody } from "@/lib/backendProxy";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
    const { id } = await params;
    return proxyToBackend({
        path: `/api/payments/${encodeURIComponent(id)}`,
        errorMessage: "Không thể lấy thông tin thanh toán",
    });
}

export async function PUT(req: NextRequest, { params }: Params) {
    const { id } = await params;
    return proxyWithJsonBody(req, {
        path: `/api/payments/${encodeURIComponent(id)}`,
        method: "PUT",
        errorMessage: "Không thể cập nhật thanh toán",
    });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
    const { id } = await params;
    return proxyToBackend({
        path: `/api/payments/${encodeURIComponent(id)}`,
        method: "DELETE",
        errorMessage: "Không thể xóa thanh toán",
    });
}
