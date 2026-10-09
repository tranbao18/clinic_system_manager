import { proxySpreadsheetUpload } from "@/lib/backendProxy";

export async function POST(req: Request) {
    return proxySpreadsheetUpload(req, {
        path: "/api/payrolls/import",
        errorMessage: "Không thể import file",
    });
}
