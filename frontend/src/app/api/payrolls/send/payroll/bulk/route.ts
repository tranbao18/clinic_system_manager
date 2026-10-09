import { NextRequest } from "next/server";
import { proxyWithJsonBody } from "@/lib/backendProxy";

// Body { payroll_ids: string[] }
export async function POST(req: NextRequest) {
    return proxyWithJsonBody(req, {
        path: "/api/payrolls/send/payroll/bulk",
        method: "POST",
        errorMessage: "Không thể gửi email bảng lương hàng loạt",
    });
}
