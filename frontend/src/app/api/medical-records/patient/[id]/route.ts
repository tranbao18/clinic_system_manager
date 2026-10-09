// KẾ THỪA
import { NextRequest, NextResponse } from "next/server";
import { getAuthHeaderServer } from "@/lib/authHeaderServer";

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "https://meppod.onrender.com";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const authHeaders = await getAuthHeaderServer();
        const headers: Record<string, string> = {};

        if (authHeaders.Authorization) {
            headers.Authorization = authHeaders.Authorization;
        }

        const res = await fetch(`${API_URL}/api/medical-records/patient/${id}`, {
            cache: "no-store",
            headers,
        });

        // Đọc body đúng một lần
        const text = await res.text();
        let data: any = null;
        try {
            data = text ? JSON.parse(text) : null;
        } catch {
            data = null;
        }

        if (!res.ok) {
            console.error(`External API (GET medical records for patient ${id}) error:`, res.status, text);
            const body = data && typeof data === "object" && !Array.isArray(data) ? data : {};
            return NextResponse.json(
                { ...body, error: body.error || body.message || "Không thể lấy hồ sơ y tế" },
                { status: res.status }
            );
        }

        const list = Array.isArray(data) ? data : [];
        return NextResponse.json(list);
    } catch (err: any) {
        console.error("GET /api/medical-records/patient/[id] exception:", err);
        return NextResponse.json(
            { error: err.message || "Lỗi hệ thống" },
            { status: 500 }
        );
    }
}
