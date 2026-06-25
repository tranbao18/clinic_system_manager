// KẾ THỪA
import { NextResponse } from "next/server";
import { getAuthHeaderServer } from "@/lib/authHeaderServer";

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "https://meppod.onrender.com";

export async function GET() {
    try {
        const authHeaders = await getAuthHeaderServer();
        const headers: Record<string, string> = {};
        if (authHeaders.Authorization) {
            headers.Authorization = authHeaders.Authorization;
        }

        const url = `${API_URL}/api/reports/medicine/inventory/value`;
        const res = await fetch(url, { cache: "no-store", headers });

        if (!res.ok) {
            const text = await res.text();
            console.error("External API (GET total medicine value) error:", res.status, text);
            return NextResponse.json({ error: "Không thể lấy tổng giá trị tồn kho", detail: text }, { status: res.status });
        }

        const data = await res.json();
        return NextResponse.json(data);
    } catch (err: any) {
        console.error("GET /api/reports/medicine/inventory/value exception:", err);
        return NextResponse.json({ error: err.message || "Lỗi hệ thống" }, { status: 500 });
    }
}
