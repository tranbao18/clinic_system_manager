// KẾ THỪA
import { NextResponse } from "next/server";
import { getAuthHeaderServer } from "@/lib/authHeaderServer";

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL 
    ? `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/schedules`
    : "https://meppod.onrender.com/api/schedules";

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

        if (!res.ok) {
            const text = await res.text();
            console.error("External API (GET schedules) error:", res.status, text);
            return NextResponse.json(
                { error: "Không thể lấy danh sách lịch trực", detail: text },
                { status: res.status }
            );
        }

        const data = await res.json();
        return NextResponse.json(data);
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

        if (!res.ok) {
            const text = await res.text();
            console.error("External API (POST schedules) error:", res.status, text);
            return NextResponse.json(
                { error: "Không thể tạo/cập nhật lịch trực", detail: text },
                { status: res.status }
            );
        }

        const data = await res.json();
        return NextResponse.json(data);
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

