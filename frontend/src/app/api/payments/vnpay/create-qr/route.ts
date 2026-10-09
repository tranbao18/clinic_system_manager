import { NextRequest } from "next/server";
import { proxyWithJsonBody } from "@/lib/backendProxy";

// Backend không có endpoint QR riêng: QR được tạo từ chính payment URL của /vnpay/create
export async function POST(req: NextRequest) {
    return proxyWithJsonBody(req, {
        path: "/api/payments/vnpay/create",
        method: "POST",
        errorMessage: "Không thể tạo QR code VNPay",
    });
}
