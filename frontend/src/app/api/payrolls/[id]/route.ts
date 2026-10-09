// KẾ THỪA
import { NextRequest } from "next/server";
import { proxyToBackend, proxyWithJsonBody } from "@/lib/backendProxy";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
    const { id } = await params;
    return proxyToBackend({
        path: `/api/payrolls/${encodeURIComponent(id)}`,
        errorMessage: "Không thể tải bảng lương",
    });
}

export async function PUT(req: NextRequest, { params }: Params) {
    const { id } = await params;
    const sendEmail = new URL(req.url).searchParams.get("sendEmail");
    return proxyWithJsonBody(req, {
        path: `/api/payrolls/${encodeURIComponent(id)}`,
        method: "PUT",
        search: sendEmail === "false" ? "?sendEmail=false" : "",
        errorMessage: "Không thể cập nhật bảng lương",
    });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
    const { id } = await params;
    return proxyToBackend({
        path: `/api/payrolls/${encodeURIComponent(id)}`,
        method: "DELETE",
        errorMessage: "Không thể xóa bảng lương",
    });
}
