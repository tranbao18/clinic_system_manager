// KẾ THỪA
import { proxyToBackend } from "@/lib/backendProxy";

export async function GET() {
    return proxyToBackend({
        path: "/api/reports/medicine/inventory/value",
        errorMessage: "Không thể lấy tổng giá trị tồn kho",
    });
}
