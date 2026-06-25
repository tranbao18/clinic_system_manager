// KẾ THỪA
import { NextRequest, NextResponse } from "next/server";
import { getAuthHeaderServer } from "@/lib/authHeaderServer";

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL
    ? `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/schedules`
    : "https://meppod.onrender.com/api/schedules";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ employee_id: string }> }
) {
    try {
        const { employee_id } = await params;
        const authHeaders = await getAuthHeaderServer();
        const headers: Record<string, string> = {};

        if (authHeaders.Authorization) {
            headers.Authorization = authHeaders.Authorization;
        }

        const res = await fetch(`${API_URL}/${employee_id}`, {
            cache: "no-store",
            headers,
        });

        if (!res.ok) {
            const text = await res.text();
            console.error("External API (GET schedule) error:", res.status, text);
            return NextResponse.json(
                { error: "Không thể lấy lịch trực", detail: text },
                { status: res.status }
            );
        }

        const data = await res.json();
        return NextResponse.json(data);
    } catch (err: unknown) {
        console.error("GET /api/schedules/[employee_id] exception:", err);
        const error = err instanceof Error ? err : { message: "Lỗi hệ thống", code: "" };
        const message = error.message || "Lỗi hệ thống";
        if ((error as any).code === 'ECONNREFUSED' || message.includes('fetch failed')) {
            return NextResponse.json(
                { error: "Không thể kết nối đến server backend. Vui lòng kiểm tra xem backend đã chạy chưa." },
                { status: 503 }
            );
        }
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ employee_id: string }> }
) {
    try {
        const { employee_id } = await params;
        const authHeaders = await getAuthHeaderServer();
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };

        if (authHeaders.Authorization) {
            headers.Authorization = authHeaders.Authorization;
        }

        const body = await req.json();

        const res = await fetch(`${API_URL}/${employee_id}`, {
            method: "PUT",
            headers,
            body: JSON.stringify(body),
            cache: "no-store",
        });

        if (!res.ok) {
            const text = await res.text();
            console.error("External API (PUT schedules) error:", res.status, text);
            return NextResponse.json(
                { error: "Không thể cập nhật lịch trực", detail: text },
                { status: res.status }
            );
        }

        const data = await res.json();
        return NextResponse.json(data);
    } catch (err: unknown) {
        console.error("PUT /api/schedules/[employee_id] exception:", err);
        const error = err instanceof Error ? err : { message: "Lỗi hệ thống", code: "" };
        const message = error.message || "Lỗi hệ thống";
        if ((error as any).code === 'ECONNREFUSED' || message.includes('fetch failed')) {
            return NextResponse.json(
                { error: "Không thể kết nối đến server backend. Vui lòng kiểm tra xem backend đã chạy chưa." },
                { status: 503 }
            );
        }
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ employee_id: string }> }
) {
    try {
        const { employee_id } = await params;
        const authHeaders = await getAuthHeaderServer();
        const headers: Record<string, string> = {};

        if (authHeaders.Authorization) {
            headers.Authorization = authHeaders.Authorization;
        }

        const res = await fetch(`${API_URL}/${employee_id}`, {
            method: "DELETE",
            headers,
            cache: "no-store",
        });

        if (!res.ok) {
            const text = await res.text();
            console.error("External API (DELETE schedules) error:", res.status, text);
            return NextResponse.json(
                { error: "Không thể xóa lịch trực", detail: text },
                { status: res.status }
            );
        }

        const data = await res.json();
        return NextResponse.json(data);
    } catch (err: unknown) {
        console.error("DELETE /api/schedules/[employee_id] exception:", err);
        const error = err instanceof Error ? err : { message: "Lỗi hệ thống", code: "" };
        const message = error.message || "Lỗi hệ thống";
        if ((error as any).code === 'ECONNREFUSED' || message.includes('fetch failed')) {
            return NextResponse.json(
                { error: "Không thể kết nối đến server backend. Vui lòng kiểm tra xem backend đã chạy chưa." },
                { status: 503 }
            );
        }
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
