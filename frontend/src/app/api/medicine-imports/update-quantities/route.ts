import { proxySpreadsheetUpload } from "@/lib/backendProxy";

export async function POST(req: Request) {
    return proxySpreadsheetUpload(req, {
        path: "/api/medicine-imports/update-quantities",
        errorMessage: "Không thể cập nhật số lượng từ file",
    });
}
