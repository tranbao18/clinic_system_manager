import { proxySpreadsheetUpload } from "@/lib/backendProxy";

export async function POST(req: Request) {
    return proxySpreadsheetUpload(req, {
        path: "/api/medicines/import",
        errorMessage: "Không thể import file",
    });
}
