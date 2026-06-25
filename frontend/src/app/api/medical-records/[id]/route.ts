// KẾ THỪA
import { NextRequest, NextResponse } from "next/server";
import { getAuthHeaderServer } from "@/lib/authHeaderServer";

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "https://meppod.onrender.com";

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

        if (!res.ok) {
            const text = await res.text();
            console.error(`External API (GET medical record ${id}) error:`, res.status, text);
            return NextResponse.json(
                { error: "Không tìm thấy hồ sơ y tế", detail: text },
                { status: res.status }
            );
        }

        const data = await res.json();
        return NextResponse.json(data);
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

        if (!res.ok) {
            const text = await res.text();
            console.error(`External API (PUT medical record ${id}) error:`, res.status, text);
            return NextResponse.json(
                { error: `Không thể cập nhật hồ sơ y tế ${id}`, detail: text },
                { status: res.status }
            );
        }

        const data = await res.json();
        return NextResponse.json(data);
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

        if (!res.ok) {
            const text = await res.text();
            console.error(`External API (DELETE medical record ${id}) error:`, res.status, text);
            return NextResponse.json(
                { error: `Không thể xóa hồ sơ y tế ${id}`, detail: text },
                { status: res.status }
            );
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

