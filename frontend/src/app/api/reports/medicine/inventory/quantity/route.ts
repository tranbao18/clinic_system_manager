// KẾ THỪA
import { proxyToBackend } from "@/lib/backendProxy";

export async function GET() {
    return proxyToBackend({
        path: "/api/reports/medicine/inventory/quantity",
        errorMessage: "Không thể lấy tổng số lượng tồn kho",
    });
}
