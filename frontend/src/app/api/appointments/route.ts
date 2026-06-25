import { NextRequest, NextResponse } from "next/server";
import { getAuthHeaderServer } from "@/lib/authHeaderServer";

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "https://meppod.onrender.com";
const APPOINTMENTS_URL = `${API_URL}/api/appointments`;

// TỰ VIẾT
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const disabled = searchParams.get("disabled");

        const rawHeaders = await getAuthHeaderServer();
        const headers: Record<string, string> = {};

        if (rawHeaders?.Authorization) {
            headers.Authorization = rawHeaders.Authorization;
        }

        let url = APPOINTMENTS_URL;
        if (disabled === "true") {
            url += `?disabled=true`;
        }

        const res = await fetch(url, {
            cache: "no-store",
            headers,
        });

        if (!res.ok) {
            const text = await res.text();
            console.error("External API (GET appointments) error:", res.status, text);
            return NextResponse.json(
                { error: "Không thể lấy danh sách lịch hẹn", detail: text },
                { status: res.status }
            );
        }

        const data = await res.json();
        let list = Array.isArray(data) ? data : data.appointments || [];

        if (disabled === "true") {
            list = list.filter((item: any) => item.disabled === true);
        } else if (disabled === "false") {
            list = list.filter((item: any) => item.disabled !== true);
        }

        return NextResponse.json(list);
    } catch (err: any) {
        console.error("GET /api/appointments exception:", err);
        return NextResponse.json(
            { error: err.message || "Lỗi hệ thống" },
            { status: 500 }
        );
    }
}
//

// TỰ VIẾT
export async function POST(req: NextRequest) {
    try {
        const rawHeaders = await getAuthHeaderServer();
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };

        if (rawHeaders?.Authorization) {
            headers.Authorization = rawHeaders.Authorization;
        }

        const body = await req.json();
        const res = await fetch(APPOINTMENTS_URL, {
            method: "POST",
            headers,
            body: JSON.stringify(body),
        });

        if (!res.ok) {
            const text = await res.text();
            console.error("External API (POST appointment) error:", res.status, text);
            return NextResponse.json(
                { error: "Không thể tạo lịch hẹn", detail: text },
                { status: res.status }
            );
        }

        const data = await res.json();
        return NextResponse.json(data, { status: 201 });
    } catch (err: any) {
        console.error("POST /api/appointments exception:", err);
        return NextResponse.json(
            { error: err.message || "Lỗi hệ thống" },
            { status: 500 }
        );
    }
}
//