// KẾ THỪA
import { NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/backendProxy";

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (!startDate || !endDate) {
        return NextResponse.json({ error: "Thiếu startDate hoặc endDate" }, { status: 400 });
    }

    return proxyToBackend({
        path: "/api/reports/profit-loss/monthly",
        search: `?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`,
        errorMessage: "Không thể lấy báo cáo lãi/lỗ theo tháng",
    });
}
