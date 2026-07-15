import { NextRequest, NextResponse } from "next/server";
import { getAuthHeaderServer } from "@/lib/authHeaderServer";

const API_URL_PATIENTS = `${process.env.NEXT_PUBLIC_BACKEND_URL || "https://meppod.onrender.com"}/api/patients`;

// TỰ VIẾT
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const authHeaders = await getAuthHeaderServer();
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };

        if (authHeaders.Authorization) {
            headers.Authorization = authHeaders.Authorization;
        }

        const backendUrl = `${API_URL_PATIENTS}/${id}/restore`;

        const res = await fetch(backendUrl, {
            method: "PUT",
            headers,
        });

        console.log('🔍 Backend response status:', res.status);

        if (!res.ok) {
            const text = await res.text();
            console.error(`Backend restore error:`, res.status, text);
            return NextResponse.json(
                { error: `Không thể khôi phục bệnh nhân ${id}`, detail: text },
                { status: res.status }
            );
        }

        const data = await res.json();
        console.log('🔍 Restore successful:', data);
        return NextResponse.json(data);
    } catch (err: any) {
        console.error("Restore patient exception:", err);
        return NextResponse.json({ error: err.message || "Lỗi hệ thống" }, { status: 500 });
    }
}
//