import { NextRequest } from "next/server";
import { proxyToBackend, toArray } from "@/lib/backendProxy";

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ invoiceId: string }> }
) {
    const { invoiceId } = await params;
    return proxyToBackend({
        path: `/api/payments/invoice/${encodeURIComponent(invoiceId)}`,
        errorMessage: "Không thể lấy thanh toán của hóa đơn",
        transform: toArray,
    });
}
