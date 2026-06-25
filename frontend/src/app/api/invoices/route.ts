// KẾ THỪA
import { NextResponse } from "next/server";
import { getAuthHeaderServer } from "@/lib/authHeaderServer";

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "https://meppod.onrender.com";
const INVOICES_URL = `${API_URL}/api/invoices`;

export async function GET(req: Request) {
    try {
        // Get auth header from the incoming request first
        const authHeader = (req as any).headers?.get?.("authorization") || (req as any).headers?.get?.("Authorization");
        const headers: Record<string, string> = {};

        if (authHeader) {
            headers.Authorization = authHeader;
        } else {
            // Fallback to getAuthHeaderServer for backward compatibility
            const authHeaders = await getAuthHeaderServer();
            if (authHeaders.Authorization) {
                headers.Authorization = authHeaders.Authorization;
            }
        }

        const res = await fetch(INVOICES_URL, {
            cache: "no-store",
            headers,
        });

        if (!res.ok) {
            let errorDetail = "";
            try {
                const errorData = await res.json();
                errorDetail = errorData.error || errorData.message || JSON.stringify(errorData);
            } catch {
                const text = await res.text();
                errorDetail = text || `HTTP ${res.status} ${res.statusText}`;
            }

            console.error("External API (GET invoices) error:", {
                status: res.status,
                statusText: res.statusText,
                detail: errorDetail,
                url: INVOICES_URL
            });

            if (res.status === 401 || res.status === 403) {
                console.warn(" Không có quyền truy cập invoices, trả về mảng rỗng");
                return NextResponse.json([]);
            }

            return NextResponse.json(
                { error: "Không thể lấy danh sách hóa đơn", detail: errorDetail },
                { status: res.status }
            );
        }

        const data = await res.json();
        return NextResponse.json(Array.isArray(data) ? data : []);
    } catch (err: any) {
        console.error("GET /api/invoices exception:", err);
        return NextResponse.json([]);
    }
}

export async function POST(req: Request) {
    try {
        // Get auth header from the incoming request first
        const authHeader = (req as any).headers?.get?.("authorization") || (req as any).headers?.get?.("Authorization");
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };

        if (authHeader) {
            headers.Authorization = authHeader;
        } else {
            // Fallback to getAuthHeaderServer for backward compatibility
            const authHeaders = await getAuthHeaderServer();
            if (authHeaders.Authorization) {
                headers.Authorization = authHeaders.Authorization;
            }
        }

        const body = await req.json();
        const res = await fetch(INVOICES_URL, {
            method: "POST",
            headers,
            body: JSON.stringify(body),
        });

        if (!res.ok) {
            const text = await res.text();
            console.error("External API (POST invoice) error:", res.status, text);
            return NextResponse.json(
                { error: "Không thể tạo hóa đơn", detail: text },
                { status: res.status }
            );
        }

        const data = await res.json();
        return NextResponse.json(data, { status: 201 });
    } catch (err: any) {
        console.error("POST /api/invoices exception:", err);
        return NextResponse.json(
            { error: err.message || "Lỗi hệ thống" },
            { status: 500 }
        );
    }
}

