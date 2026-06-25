// KẾ THỪA
import { NextRequest, NextResponse } from "next/server";
import { getAuthHeaderServer } from "@/lib/authHeaderServer";

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "https://meppod.onrender.com";
const MEDICINE_IMPORTS_URL = `${API_URL}/api/medicine-imports`;

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const disabled = searchParams.get("disabled");

        const rawHeaders = await getAuthHeaderServer();
        const headers: Record<string, string> = {};

        if (rawHeaders?.Authorization) {
            headers.Authorization = rawHeaders.Authorization;
        }
        
        let url = MEDICINE_IMPORTS_URL;
        if (disabled === "true") {
            url += `?disabled=true`;
        }
        
        const res = await fetch(url, {
            cache: "no-store",
            headers,
        });

        if (!res.ok) {
            const text = await res.text();
            console.error("External API (GET medicine-imports) error:", res.status, text);
            return NextResponse.json(
                { error: "Không thể lấy danh sách nhập thuốc", detail: text },
                { status: res.status }
            );
        }

        const data = await res.json();
        let list = Array.isArray(data) ? data : data.medicineImports || [];
        
        if (disabled === "true") {
            list = list.filter((item: any) => item.disabled === true);
        } else if (disabled === "false") {
            list = list.filter((item: any) => item.disabled !== true);
        }
        
        return NextResponse.json(list);
    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "Lỗi hệ thống";
        console.error("GET /api/medicine-imports exception:", err);
        return NextResponse.json(
            { error: errorMessage },
            { status: 500 }
        );
    }
}

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
        const res = await fetch(MEDICINE_IMPORTS_URL, {
            method: "POST",
            headers,
            body: JSON.stringify(body),
        });

        if (!res.ok) {
            const text = await res.text();
            console.error("External API (POST medicine-import) error:", res.status, text);
            return NextResponse.json(
                { error: "Không thể tạo nhập thuốc", detail: text },
                { status: res.status }
            );
        }

        const data = await res.json();
        return NextResponse.json(data, { status: 201 });
    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "Lỗi hệ thống";
        console.error("POST /api/medicine-imports exception:", err);
        return NextResponse.json(
            { error: errorMessage },
            { status: 500 }
        );
    }
}

