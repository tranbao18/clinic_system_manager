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

        if (!res.ok) {
            const text = await res.text();
            console.error(`External API (GET medical records for patient ${id}) error:`, res.status, text);
            return NextResponse.json(
                { error: "Không thể lấy hồ sơ y tế", detail: text },
                { status: res.status }
            );
        }

        const data = await res.json();
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

