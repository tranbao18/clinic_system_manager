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

// TỰ VIẾT
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const authHeaders = await getAuthHeaderServer();
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };

        if (authHeaders.Authorization) {
            headers.Authorization = authHeaders.Authorization;
        }

        const backendUrl = `${API_URL_PATIENTS}/${id}/restore`;

        const res = await fetch(backendUrl, {
            method: "PUT",
            headers,
        });

        const { data, text } = await readBody(res);
        if (!res.ok) {
            console.error(`Backend restore error:`, res.status, text);
            return backendError(res.status, data, text, "Không thể khôi phục bệnh nhân");
        }

        return NextResponse.json(data ?? {});
    } catch (err: any) {
        console.error("Restore patient exception:", err);
        return NextResponse.json({ error: err.message || "Lỗi hệ thống" }, { status: 500 });
    }
}
//