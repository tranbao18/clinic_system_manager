// KẾ THỪA
import { NextRequest, NextResponse } from "next/server";
import { getAuthHeaderServer } from "@/lib/authHeaderServer";

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "https://meppod.onrender.com";
const MEDICINE_IMPORTS_URL = `${API_URL}/api/medicine-imports`;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const authHeaders = await getAuthHeaderServer();
        const headers: Record<string, string> = {};

        if (authHeaders.Authorization) {
            headers.Authorization = authHeaders.Authorization;
        }

        const res = await fetch(`${MEDICINE_IMPORTS_URL}/${id}`, { cache: "no-store", headers });
        if (!res.ok) {
            const text = await res.text();
            console.error(`External API (GET medicine-import ${id}) error:`, res.status, text);
            return NextResponse.json(
                { error: "Không tìm thấy nhập thuốc", detail: text },
                { status: res.status }
            );
        }

        const data = await res.json();
        return NextResponse.json(data);
    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "Lỗi hệ thống";
        console.error("GET /api/medicine-imports/[id] exception:", err);
        return NextResponse.json({ error: errorMessage }, { status: 500 });
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

        const res = await fetch(`${MEDICINE_IMPORTS_URL}/${id}`, {
            method: "PUT",
            headers,
            body: JSON.stringify(body),
        });

        if (!res.ok) {
            const text = await res.text();
            console.error(`External API (PUT medicine-import ${id}) error:`, res.status, text);
            return NextResponse.json(
                { error: `Không thể cập nhật nhập thuốc ${id}`, detail: text },
                { status: res.status }
            );
        }

        const data = await res.json();
        return NextResponse.json(data);
    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "Lỗi hệ thống";
        console.error("PUT /api/medicine-imports/[id] exception:", err);
        return NextResponse.json({ error: errorMessage }, { status: 500 });
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

        const res = await fetch(`${MEDICINE_IMPORTS_URL}/${id}`, { method: "DELETE", headers });
        if (!res.ok) {
            const text = await res.text();
            console.error(`External API (DELETE medicine-import ${id}) error:`, res.status, text);
            return NextResponse.json(
                { error: `Không thể xóa nhập thuốc ${id}`, detail: text },
                { status: res.status }
            );
        }
        return NextResponse.json({ message: "Xóa nhập thuốc thành công" });
    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "Lỗi hệ thống";
        console.error("DELETE /api/medicine-imports/[id] exception:", err);
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}

