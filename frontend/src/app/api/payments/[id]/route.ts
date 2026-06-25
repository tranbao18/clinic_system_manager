import { NextRequest, NextResponse } from "next/server";
import { getAuthHeaderServer } from "@/lib/authHeaderServer";

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "https://meppod.onrender.com";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const rawHeaders = await getAuthHeaderServer();
        const headers: Record<string, string> = {};

        if (rawHeaders?.Authorization) {
            headers.Authorization = rawHeaders.Authorization;
        }
        const url = `${API_URL}/api/payments/${id}`;

        const res = await fetch(url, {
            cache: "no-store",
            headers,
        });

        if (!res.ok) {
            const text = await res.text();
            console.error("External API (GET payment) error:", res.status, text);
            return NextResponse.json(
                { error: "Không thể lấy thông tin thanh toán", detail: text },
                { status: res.status }
            );
        }

        const data = await res.json();
        return NextResponse.json(data);
    } catch (err: any) {
        console.error("GET /api/payments/[id] exception:", err);
        return NextResponse.json(
            { error: err.message || "Lỗi hệ thống" },
            { status: 500 }
        );
    }
}

export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const authHeaders = await getAuthHeaderServer();
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };

        if (authHeaders.Authorization) {
            headers.Authorization = authHeaders.Authorization;
        }

        const body = await req.json();
        const url = `${API_URL}/api/payments/${id}`;

        const res = await fetch(url, {
            method: "PUT",
            headers,
            body: JSON.stringify(body),
        });

        if (!res.ok) {
            const text = await res.text();
            console.error("External API (PUT payment) error:", res.status, text);
            return NextResponse.json(
                { error: "Không thể cập nhật thanh toán", detail: text },
                { status: res.status }
            );
        }

        const data = await res.json();
        return NextResponse.json(data);
    } catch (err: any) {
        console.error("PUT /api/payments/[id] exception:", err);
        return NextResponse.json(
            { error: err.message || "Lỗi hệ thống" },
            { status: 500 }
        );
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const rawHeaders = await getAuthHeaderServer();
        const headers: Record<string, string> = {};

        if (rawHeaders?.Authorization) {
            headers.Authorization = rawHeaders.Authorization;
        }
        const url = `${API_URL}/api/payments/${id}`;

        const res = await fetch(url, {
            method: "DELETE",
            headers,
        });

        if (!res.ok) {
            const text = await res.text();
            console.error("External API (DELETE payment) error:", res.status, text);
            return NextResponse.json(
                { error: "Không thể xóa thanh toán", detail: text },
                { status: res.status }
            );
        }

        return NextResponse.json({ message: "Deleted" });
    } catch (err: any) {
        console.error("DELETE /api/payments/[id] exception:", err);
        return NextResponse.json(
            { error: err.message || "Lỗi hệ thống" },
            { status: 500 }
        );
    }
}

