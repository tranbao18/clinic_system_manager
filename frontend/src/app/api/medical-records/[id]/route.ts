// KẾ THỪA
import { NextRequest, NextResponse } from "next/server";
import { getAuthHeaderServer } from "@/lib/authHeaderServer";

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "https://meppod.onrender.com";

// Đọc body đúng một lần (tránh lỗi "Body is unusable")
async function readBody(res: Response): Promise<{ data: any; text: string }> {
    const text = await res.text();
    try {
        return { data: text ? JSON.parse(text) : null, text };
    } catch {
        return { data: null, text };
    }
}

// Giữ nguyên status và thông điệp lỗi của backend (vd: 403 không phải bác sĩ phụ trách)
function backendError(status: number, data: any, text: string, fallback: string) {
    const body = data && typeof data === "object" && !Array.isArray(data) ? data : {};
    return NextResponse.json(
        {
            ...body,
            error: body.error || body.message || fallback,
            ...(data === null && text ? { detail: text.slice(0, 500) } : {}),
        },
        { status }
    );
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const rawHeaders = await getAuthHeaderServer();
        const headers: Record<string, string> = {};

        if (rawHeaders?.Authorization) {
            headers.Authorization = rawHeaders.Authorization;
        }

        const res = await fetch(`${API_URL}/api/medical-records/${id}`, {
            cache: "no-store",
            headers,
        });

        const { data, text } = await readBody(res);
        if (!res.ok) {
            console.error(`External API (GET medical record ${id}) error:`, res.status, text);
            return backendError(res.status, data, text, "Không tìm thấy hồ sơ y tế");
        }

        return NextResponse.json(data ?? {});
    } catch (err: any) {
        console.error("GET /api/medical-records/[id] exception:", err);
        return NextResponse.json(
            { error: err.message || "Lỗi hệ thống" },
            { status: 500 }
        );
    }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await req.json();
        const authHeaders = await getAuthHeaderServer();
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };

        if (authHeaders.Authorization) {
            headers.Authorization = authHeaders.Authorization;
        }

        const res = await fetch(`${API_URL}/api/medical-records/${id}`, {
            method: "PUT",
            headers,
            body: JSON.stringify(body),
        });

        const { data, text } = await readBody(res);
        if (!res.ok) {
            console.error(`External API (PUT medical record ${id}) error:`, res.status, text);
            return backendError(res.status, data, text, "Không thể cập nhật hồ sơ y tế");
        }

        return NextResponse.json(data ?? {});
    } catch (err: any) {
        console.error("PUT /api/medical-records/[id] exception:", err);
        return NextResponse.json(
            { error: err.message || "Lỗi hệ thống" },
            { status: 500 }
        );
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const rawHeaders = await getAuthHeaderServer();
        const headers: Record<string, string> = {};

        if (rawHeaders?.Authorization) {
            headers.Authorization = rawHeaders.Authorization;
        }
        const { searchParams } = new URL(req.url);
        const hard = searchParams.get("hard");
        let url = `${API_URL}/api/medical-records/${id}`;
        if (hard === "true") url += `?hard=true`;

        const res = await fetch(url, {
            method: "DELETE",
            headers,
        });

        const { data, text } = await readBody(res);
        if (!res.ok) {
            console.error(`External API (DELETE medical record ${id}) error:`, res.status, text);
            return backendError(res.status, data, text, "Không thể xóa hồ sơ y tế");
        }

        return NextResponse.json({ message: "Xóa hồ sơ y tế thành công" });
    } catch (err: any) {
        console.error("DELETE /api/medical-records/[id] exception:", err);
        return NextResponse.json(
            { error: err.message || "Lỗi hệ thống" },
            { status: 500 }
        );
    }
}
