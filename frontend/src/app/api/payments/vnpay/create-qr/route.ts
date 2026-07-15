import { NextResponse } from "next/server";
import { getAuthHeaderServer } from "@/lib/authHeaderServer";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || "https://meppod.onrender.com";

export async function POST(req: Request) {
    try {
        const authHeaders = await getAuthHeaderServer();
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            ...(authHeaders.Authorization && { Authorization: authHeaders.Authorization }),
        };

        console.log('🔧 Backend URL:', BACKEND_URL);
        console.log('🔐 Auth headers:', {
            hasAuth: !!authHeaders.Authorization,
            authPrefix: authHeaders.Authorization ? authHeaders.Authorization.substring(0, 20) + '...' : 'none'
        });

        const body = await req.json();
        console.log('📤 Request body:', { invoice_id: body.invoice_id });

        const requestUrl = `${BACKEND_URL}/api/payments/vnpay/create-qr`;
        console.log('🌐 Request URL:', requestUrl);

        const res = await fetch(requestUrl, {
            method: "POST",
            headers,
            body: JSON.stringify(body),
        });

        if (!res.ok) {
            const text = await res.text();
            let errorData;
            try {
                errorData = JSON.parse(text);
            } catch {
                errorData = {
                    error: text.substring(0, 200) || "Lỗi không xác định từ backend",
                    isHtml: text.includes('<html') || text.includes('<!DOCTYPE')
                };
            }

            console.error("❌ External API (POST vnpay/create-qr) error:", {
                status: res.status,
                statusText: res.statusText,
                url: `${BACKEND_URL}/api/payments/vnpay/create-qr`,
                error: errorData,
                hasAuth: !!authHeaders.Authorization,
                responsePreview: text.substring(0, 500)
            });

            if (res.status === 403) {
                return NextResponse.json(
                    {
                        error: errorData.message || errorData.error || "Bạn không có quyền thực hiện thao tác này. Vui lòng đăng nhập với tài khoản Admin hoặc Accountant.",
                        detail: errorData
                    },
                    { status: 403 }
                );
            }

            if (res.status === 401) {
                return NextResponse.json(
                    {
                        error: errorData.message || errorData.error || "Bạn cần đăng nhập để thực hiện thao tác này.",
                        detail: errorData
                    },
                    { status: 401 }
                );
            }

            return NextResponse.json(
                {
                    error: errorData.error || errorData.message || "Không thể tạo QR code VNPay",
                    detail: errorData.detail || errorData
                },
                { status: res.status }
            );
        }

        const text = await res.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch {
            throw new Error("Response không phải JSON hợp lệ");
        }
        return NextResponse.json(data, { status: 200 });
    } catch (err: any) {
        console.error("POST /api/payments/vnpay/create-qr exception:", err);
        return NextResponse.json(
            { error: err.message || "Lỗi hệ thống" },
            { status: 500 }
        );
    }
}
