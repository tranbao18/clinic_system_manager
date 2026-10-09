// KẾ THỪA
import { NextRequest, NextResponse } from "next/server";
import { getAuthHeaderServer } from "@/lib/authHeaderServer";

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "https://meppod.onrender.com";
const MEDICAL_RECORDS_URL = `${API_URL}/api/medical-records`;

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

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const disabled = searchParams.get("disabled");

        const rawHeaders = await getAuthHeaderServer();
        const headers: Record<string, string> = {};

        if (rawHeaders?.Authorization) {
            headers.Authorization = rawHeaders.Authorization;
        }

        let url = MEDICAL_RECORDS_URL;
        if (disabled === "true") {
            url += `?disabled=true`;
        }

        const res = await fetch(url, {
            cache: "no-store",
            headers,
        });

        const { data, text } = await readBody(res);
        if (!res.ok) {
            console.error("External API (GET medical records) error:", res.status, text);
            return backendError(res.status, data, text, "Không thể lấy danh sách hồ sơ y tế");
        }

        let list = Array.isArray(data) ? data : data?.medicalRecords || [];

        if (disabled === "true") {
            list = list.filter((item: any) => item.disabled === true);
        } else if (disabled === "false") {
            list = list.filter((item: any) => item.disabled !== true);
        }

        return NextResponse.json(list);
    } catch (err: any) {
        console.error("GET /api/medical-records exception:", err);
        return NextResponse.json(
            { error: err.message || "Lỗi hệ thống" },
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
        const res = await fetch(MEDICAL_RECORDS_URL, {
            method: "POST",
            headers,
            body: JSON.stringify(body),
        });

        const { data, text } = await readBody(res);
        if (!res.ok) {
            console.error("External API (POST medical record) error:", res.status, text);
            return backendError(res.status, data, text, "Không thể tạo hồ sơ y tế");
        }

        return NextResponse.json(data ?? {}, { status: 201 });
    } catch (err: any) {
        console.error("POST /api/medical-records exception:", err);
        return NextResponse.json(
            { error: err.message || "Lỗi hệ thống" },
            { status: 500 }
        );
    }
}
