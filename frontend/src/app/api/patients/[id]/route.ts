import { NextRequest, NextResponse } from "next/server";
import { getAuthHeaderServer } from "@/lib/authHeaderServer";

const API_URL_PATIENTS = `${process.env.NEXT_PUBLIC_BACKEND_URL || "https://meppod.onrender.com"}/api/patients`;

// Đọc body đúng một lần (tránh lỗi "Body is unusable")
async function readBody(res: Response): Promise<{ data: any; text: string }> {
    const text = await res.text();
    try {
        return { data: text ? JSON.parse(text) : null, text };
    } catch {
        return { data: null, text };
    }
}

// Giữ nguyên status và thông điệp lỗi của backend
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

        const res = await fetch(`${API_URL_PATIENTS}/${id}`, { cache: "no-store", headers });
        const { data, text } = await readBody(res);
        if (!res.ok) {
            console.error(`External API (GET patient ${id}) error:`, res.status, text);
            return backendError(res.status, data, text, "Không tìm thấy bệnh nhân");
        }

        return NextResponse.json(data ?? {});
    } catch (err: any) {
        console.error("GET /api/patients/[id] exception:", err);
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

        const res = await fetch(`${API_URL_PATIENTS}/${id}`, {
            method: "PUT",
            headers,
            body: JSON.stringify(body),
        });

        const { data, text } = await readBody(res);
        if (!res.ok) {
            console.error(`External API (PUT patient ${id}) error:`, res.status, text);
            return backendError(res.status, data, text, "Không thể cập nhật bệnh nhân");
        }

        return NextResponse.json(data ?? {});
    } catch (err: any) {
        console.error("PUT /api/patients/[id] exception:", err);
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
        const { searchParams } = new URL(req.url);
        const hard = searchParams.get("hard");
        let url = `${API_URL_PATIENTS}/${id}`;
        if (hard === "true") url += `?hard=true`;

        const res = await fetch(url, { method: "DELETE", headers });
        const { data, text } = await readBody(res);
        if (!res.ok) {
            console.error(`External API (DELETE patient ${id}) error:`, res.status, text);
            return backendError(res.status, data, text, "Không thể xóa bệnh nhân");
        }

        return NextResponse.json({ message: "Xóa bệnh nhân thành công" });
    } catch (err: any) {
        console.error("DELETE /api/patients/[id] exception:", err);
        return NextResponse.json({ error: err.message || "Lỗi hệ thống" }, { status: 500 });
    }
}


export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const authHeaders = await getAuthHeaderServer();
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };

        if (authHeaders.Authorization) {
            headers.Authorization = authHeaders.Authorization;
        }

        const body = await req.json().catch(() => ({}));

        const res = await fetch(`${API_URL_PATIENTS}/${id}`, {
            method: "PATCH",
            headers,
            body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined,
        });

        const { data, text } = await readBody(res);
        if (!res.ok) {
            console.error(`External API (PATCH patient ${id}) error:`, res.status, text);
            return backendError(res.status, data, text, "Không thể cập nhật bệnh nhân");
        }

        return NextResponse.json(data ?? {});
    } catch (err: any) {
        console.error("PATCH /api/patients/[id] exception:", err);
        return NextResponse.json({ error: err.message || "Lỗi hệ thống" }, { status: 500 });
    }
}
