import { NextRequest } from "next/server";
import { proxyWithJsonBody } from "@/lib/backendProxy";

// VNPay đang tắt trên giao diện; route giữ lại để tạo URL thanh toán khi bật lại
export async function POST(req: NextRequest) {
    return proxyWithJsonBody(req, {
        path: "/api/payments/vnpay/create",
        method: "POST",
        errorMessage: "Không thể tạo URL thanh toán VNPay",
    });
}
