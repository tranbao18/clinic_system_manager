// KẾ THỪA
import { NextResponse } from "next/server";
import { getAuthHeaderServer } from "@/lib/authHeaderServer";

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL
    ? `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/schedules`
    : "https://meppod.onrender.com/api/schedules";

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

export async function GET(req: Request) {
    try {
        const authHeaders = await getAuthHeaderServer();
        const headers: Record<string, string> = {};
        if (authHeaders?.Authorization) {
            headers.Authorization = authHeaders.Authorization;
        }
        const { searchParams } = new URL(req.url);
        const employee_id = searchParams.get("employee_id");

        const url = employee_id ? `${API_URL}/${employee_id}` : API_URL;
        const res = await fetch(url, {
            cache: "no-store",
            headers,
        });

        const { data, text } = await readBody(res);
        if (!res.ok) {
            console.error("External API (GET schedules) error:", res.status, text);
            return backendError(res.status, data, text, "Không thể lấy danh sách lịch trực");
        }

        return NextResponse.json(data ?? []);
    } catch (err: any) {
        console.error("GET /api/schedules exception:", err);
        if (err.code === 'ECONNREFUSED' || err.message?.includes('fetch failed')) {
            return NextResponse.json(
                { error: "Không thể kết nối đến server backend. Vui lòng kiểm tra xem backend đã chạy chưa." },
                { status: 503 }
            );
        }
        return NextResponse.json(
            { error: err.message || "Lỗi hệ thống" },
            { status: 500 }
        );
    }
}

export async function POST(req: Request) {
    try {
        const authHeaders = await getAuthHeaderServer();
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };
        if (authHeaders?.Authorization) {
            headers.Authorization = authHeaders.Authorization;
        }
        const body = await req.json();

        const res = await fetch(API_URL, {
            method: "POST",
            headers,
            body: JSON.stringify(body),
            cache: "no-store",
        });

        const { data, text } = await readBody(res);
        if (!res.ok) {
            console.error("External API (POST schedules) error:", res.status, text);
            return backendError(res.status, data, text, "Không thể tạo/cập nhật lịch trực");
        }

        return NextResponse.json(data ?? {});
    } catch (err: any) {
        console.error("POST /api/schedules exception:", err);
        if (err.code === 'ECONNREFUSED' || err.message?.includes('fetch failed')) {
            return NextResponse.json(
                { error: "Không thể kết nối đến server backend. Vui lòng kiểm tra xem backend đã chạy chưa." },
                { status: 503 }
            );
        }
        return NextResponse.json(
            { error: err.message || "Lỗi hệ thống" },
            { status: 500 }
        );
    }
}
