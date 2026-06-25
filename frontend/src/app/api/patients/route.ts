// KẾ THỪA
import { NextRequest, NextResponse } from "next/server";
import { getAuthHeaderServer } from "@/lib/authHeaderServer";

const API_URL = "https://meppod.onrender.com/api/patients";

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const disabled = searchParams.get("disabled");

        const rawHeaders = await getAuthHeaderServer();
        const headers: Record<string, string> = {};

        if (rawHeaders?.Authorization) {
            headers.Authorization = rawHeaders.Authorization;
        }

        let url = API_URL;
        if (disabled === "true") {
            url += `?disabled=true`;
        }

        const res = await fetch(url, {
            cache: "no-store",
            headers,
        });

        if (!res.ok) {
            const text = await res.text();
            console.error("External API (GET patients) error:", res.status, text);
            return NextResponse.json(
                { error: "Không thể lấy danh sách bệnh nhân", detail: text },
                { status: res.status }
            );
        }

        const data = await res.json();

        let list = Array.isArray(data) ? data : data.patients || [];

        if (disabled === "true") {
            list = list.filter((item: any) => item.disabled === true);
        } else if (disabled === "false") {
            list = list.filter((item: any) => item.disabled !== true);
        }

        return NextResponse.json(list);
    } catch (err: any) {
        console.error("GET /api/patients exception:", err);
        return NextResponse.json(
            { error: err.message || "Lỗi hệ thống" },
            { status: 500 }
        );
    }
}
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
        const res = await fetch(API_URL, {
            method: "POST",
            headers,
            body: JSON.stringify(body),
        });

        if (!res.ok) {
            const text = await res.text();
            console.error("External API (POST patient) error:", res.status, text);
            return NextResponse.json(
                { error: "Không thể tạo bệnh nhân", detail: text },
                { status: res.status }
            );
        }

        const data = await res.json();
        return NextResponse.json(data, { status: 201 });
    } catch (err: any) {
        console.error("POST /api/patients exception:", err);
        return NextResponse.json({ error: err.message || "Lỗi hệ thống" }, { status: 500 });
    }
}
//