// KẾ THỪA
import { proxyToBackend } from "@/lib/backendProxy";

export async function GET() {
    return proxyToBackend({
        path: "/api/reports/medicine/inventory",
        errorMessage: "Không thể lấy tồn kho thuốc",
    });
}
