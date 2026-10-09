// KẾ THỪA
import { NextRequest, NextResponse } from "next/server";
import { getAuthHeaderServer } from "@/lib/authHeaderServer";

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "https://meppod.onrender.com";
const APPOINTMENTS_URL = `${API_URL}/api/appointments`;

// Đọc body đúng một lần (tránh lỗi "Body is unusable")
async function readBody(res: Response): Promise<{ data: any; text: string }> {
    const text = await res.text();
    try {
        return { data: text ? JSON.parse(text) : null, text };
    } catch {
        return { data: null, text };
    }
}

// Giữ nguyên status và thông điệp lỗi của backend (vd: 409 trùng lịch)
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
        const authHeaders = await getAuthHeaderServer();
        const headers: Record<string, string> = {};

        if (authHeaders.Authorization) {
            headers.Authorization = authHeaders.Authorization;
        }

        const res = await fetch(`${APPOINTMENTS_URL}/${id}`, { cache: "no-store", headers });
        const { data, text } = await readBody(res);
        if (!res.ok) {
            console.error(`External API (GET appointment ${id}) error:`, res.status, text);
            return backendError(res.status, data, text, "Không tìm thấy lịch hẹn");
        }

        return NextResponse.json(data ?? {});
    } catch (err: any) {
        console.error("GET /api/appointments/[id] exception:", err);
        return NextResponse.json({ error: err.message || "Lỗi hệ thống" }, { status: 500 });
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

        const res = await fetch(`${APPOINTMENTS_URL}/${id}`, {
            method: "PUT",
            headers,
            body: JSON.stringify(body),
        });

        const { data, text } = await readBody(res);
        if (!res.ok) {
            console.error(`External API (PUT appointment ${id}) error:`, res.status, text);
            return backendError(res.status, data, text, "Không thể cập nhật lịch hẹn");
        }

        return NextResponse.json(data ?? {});
    } catch (err: any) {
        console.error("PUT /api/appointments/[id] exception:", err);
        return NextResponse.json({ error: err.message || "Lỗi hệ thống" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const authHeaders = await getAuthHeaderServer();
        const headers: Record<string, string> = {};

        if (authHeaders.Authorization) {
            headers.Authorization = authHeaders.Authorization;
        }

        // Chuyển tiếp nguyên query của client; mặc định backend xóa mềm, hard=true chỉ có hiệu lực với Admin
        const { search } = new URL(req.url);
        const backendUrl = `${APPOINTMENTS_URL}/${id}${search}`;

        const res = await fetch(backendUrl, { method: "DELETE", headers });
        const { data, text } = await readBody(res);

        if (!res.ok) {
            console.error(`❌ [API ROUTE] DELETE appointment ${id} error:`, res.status, text);
            return backendError(res.status, data, text, "Không thể xóa lịch hẹn");
        }

        return NextResponse.json(
            data && typeof data === "object" ? data : { message: "Xóa lịch hẹn thành công" }
        );
    } catch (err: any) {
        console.error("DELETE /api/appointments/[id] exception:", err);
        return NextResponse.json({ error: err.message || "Lỗi hệ thống" }, { status: 500 });
    }
}
