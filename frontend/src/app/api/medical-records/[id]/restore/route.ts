import { NextRequest, NextResponse } from "next/server";
import { getAuthHeaderServer } from "@/lib/authHeaderServer";

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "https://meppod.onrender.com";

// Khôi phục hồ sơ y tế đã xóa mềm (backend chỉ cho Admin)
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

        const reqBody = await req.text();
        const res = await fetch(`${API_URL}/api/medical-records/${id}/restore`, {
            method: "PUT",
            headers,
            body: reqBody || undefined,
        });

        // Đọc body đúng một lần, trả nguyên status của backend
        const text = await res.text();
        let data: any = null;
        try {
            data = text ? JSON.parse(text) : null;
        } catch {
            data = null;
        }

        if (!res.ok) {
            console.error(`External API (PUT restore medical record ${id}) error:`, res.status, text);
            const body = data && typeof data === "object" && !Array.isArray(data) ? data : {};
            return NextResponse.json(
                {
                    ...body,
                    error: body.error || body.message || "Không thể khôi phục hồ sơ y tế",
                    ...(data === null && text ? { detail: text.slice(0, 500) } : {}),
                },
                { status: res.status }
            );
        }

        return NextResponse.json(data ?? { message: "Đã khôi phục" });
    } catch (err: any) {
        console.error("PUT /api/medical-records/[id]/restore exception:", err);
        return NextResponse.json(
            { error: err.message || "Lỗi hệ thống" },
            { status: 500 }
        );
    }
}
