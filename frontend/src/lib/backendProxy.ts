// Helper proxy dùng chung cho các route /api (hóa đơn, thanh toán, thuốc, nhập thuốc, lương, báo cáo).
// Thư mục "_lib" là private folder của App Router nên không sinh route.
import { NextResponse } from "next/server";
import { getAuthHeaderServer } from "@/lib/authHeaderServer";

export const BACKEND_URL_MISSING_MESSAGE = "Chưa cấu hình NEXT_PUBLIC_BACKEND_URL";

// Không fallback sang URL production/localhost: thiếu cấu hình thì báo lỗi rõ ràng
export function getBackendBaseUrl(): string | null {
    const raw = process.env.NEXT_PUBLIC_BACKEND_URL?.trim();
    return raw ? raw.replace(/\/+$/, "") : null;
}

export function backendUrlMissingResponse() {
    return NextResponse.json({ error: BACKEND_URL_MISSING_MESSAGE }, { status: 500 });
}

export interface ParsedBody {
    isJson: boolean;
    json: unknown;
    text: string;
}

// Đọc body đúng một lần (đọc 2 lần sẽ lỗi "Body is unusable")
export async function readBody(res: Response): Promise<ParsedBody> {
    const text = await res.text();
    if (!text) return { isJson: true, json: null, text };
    try {
        return { isJson: true, json: JSON.parse(text), text };
    } catch {
        return { isJson: false, json: undefined, text };
    }
}

const KNOWN_MESSAGES: Record<string, string> = {
    "No token": "Bạn cần đăng nhập để thực hiện thao tác này",
    "Not found": "Không tìm thấy dữ liệu",
};

// Giữ nguyên các trường backend trả về (vd: shortages, invoice_id, errors) và luôn có `error` để client hiển thị.
// Lỗi 5xx thường là thông báo kỹ thuật nên hiển thị thông báo chung, chi tiết để ở `detail`.
export function buildErrorBody(parsed: ParsedBody, status: number, fallback: string): Record<string, unknown> {
    const body = parsed.json;
    if (parsed.isJson && body && typeof body === "object" && !Array.isArray(body)) {
        const obj = body as Record<string, unknown>;
        const raw =
            (typeof obj.error === "string" && obj.error) ||
            (typeof obj.message === "string" && obj.message) ||
            "";
        if (status >= 500) {
            return { ...obj, error: fallback, detail: raw || undefined };
        }
        return { ...obj, error: KNOWN_MESSAGES[raw] || raw || fallback };
    }
    return {
        error: fallback,
        detail: parsed.text ? parsed.text.slice(0, 300) : `HTTP ${status}`,
    };
}

export interface ProxyOptions {
    /** Đường dẫn backend, ví dụ "/api/invoices/123" */
    path: string;
    method?: "GET" | "POST" | "PUT" | "DELETE";
    /** Query string nhận từ client (dạng "?a=b" hoặc ""), chuyển tiếp nguyên vẹn */
    search?: string;
    /** Body JSON gửi lên backend */
    body?: unknown;
    /** Body multipart (upload file) */
    formData?: FormData;
    /** Thông báo lỗi tiếng Việt khi backend không trả thông báo dùng được */
    errorMessage: string;
    /** Biến đổi dữ liệu thành công trước khi trả về client */
    transform?: (data: unknown) => unknown;
}

export async function proxyToBackend(opts: ProxyOptions): Promise<NextResponse> {
    const base = getBackendBaseUrl();
    if (!base) return backendUrlMissingResponse();

    const method = opts.method ?? "GET";
    const url = `${base}${opts.path}${opts.search ?? ""}`;

    try {
        const auth = await getAuthHeaderServer();
        const headers: Record<string, string> = {};
        if (auth.Authorization) headers.Authorization = auth.Authorization;

        let body: BodyInit | undefined;
        if (opts.formData) {
            body = opts.formData;
        } else if (opts.body !== undefined) {
            headers["Content-Type"] = "application/json";
            body = JSON.stringify(opts.body);
        }

        const res = await fetch(url, { method, headers, body, cache: "no-store" });
        const parsed = await readBody(res);

        if (!res.ok) {
            console.error(`[proxy] ${method} ${opts.path} -> ${res.status}`, parsed.isJson ? parsed.json : parsed.text.slice(0, 300));
            return NextResponse.json(buildErrorBody(parsed, res.status, opts.errorMessage), { status: res.status });
        }

        if (!parsed.isJson) {
            console.error(`[proxy] ${method} ${opts.path} trả về dữ liệu không phải JSON:`, parsed.text.slice(0, 300));
            return NextResponse.json({ error: "Phản hồi từ máy chủ không hợp lệ" }, { status: 502 });
        }

        const payload = opts.transform ? opts.transform(parsed.json) : parsed.json;
        // 204/205 không được có body
        const status = res.status === 204 || res.status === 205 ? 200 : res.status;
        return NextResponse.json(payload ?? {}, { status });
    } catch (err: unknown) {
        console.error(`[proxy] ${method} ${opts.path} exception:`, err);
        return NextResponse.json(
            {
                error: "Không thể kết nối tới máy chủ",
                detail: err instanceof Error ? err.message : String(err),
            },
            { status: 502 }
        );
    }
}

/** Đọc body JSON từ client (cho phép rỗng) rồi chuyển tiếp; body sai định dạng trả 400 */
export async function proxyWithJsonBody(req: Request, opts: Omit<ProxyOptions, "body" | "formData">): Promise<NextResponse> {
    let body: unknown;
    try {
        const text = await req.text();
        body = text ? JSON.parse(text) : undefined;
    } catch {
        return NextResponse.json({ error: "Dữ liệu gửi lên không hợp lệ" }, { status: 400 });
    }
    return proxyToBackend({ ...opts, body });
}

const SPREADSHEET_TYPES = [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
    "application/vnd.ms-excel", // .xls
    "text/csv", // .csv
];
const SPREADSHEET_EXTENSIONS = [".xlsx", ".xls", ".csv"];
const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;

/** Kiểm tra file Excel/CSV (field "file") rồi chuyển tiếp lên backend dạng multipart */
export async function proxySpreadsheetUpload(req: Request, opts: { path: string; errorMessage: string }): Promise<NextResponse> {
    let file: File | null = null;
    try {
        const formData = await req.formData();
        const value = formData.get("file");
        file = value instanceof File ? value : null;
    } catch {
        return NextResponse.json({ error: "Dữ liệu upload không hợp lệ" }, { status: 400 });
    }

    if (!file) {
        return NextResponse.json({ error: "Không có file được chọn" }, { status: 400 });
    }

    const name = file.name.toLowerCase();
    const extension = name.substring(name.lastIndexOf("."));
    if (!SPREADSHEET_TYPES.includes(file.type) && !SPREADSHEET_EXTENSIONS.includes(extension)) {
        return NextResponse.json(
            { error: "Định dạng file không được hỗ trợ. Chỉ chấp nhận file Excel (.xlsx, .xls) hoặc CSV (.csv)" },
            { status: 400 }
        );
    }

    if (file.size > MAX_UPLOAD_SIZE) {
        return NextResponse.json({ error: "File quá lớn. Kích thước tối đa là 10MB" }, { status: 400 });
    }

    const uploadFormData = new FormData();
    uploadFormData.append("file", file);
    return proxyToBackend({ path: opts.path, method: "POST", formData: uploadFormData, errorMessage: opts.errorMessage });
}

/** Chuẩn hóa dữ liệu danh sách thành mảng */
export function toArray(data: unknown): unknown[] {
    return Array.isArray(data) ? data : [];
}

/** Query string của request đến (bao gồm dấu "?"), "" nếu không có */
export function getSearch(req: Request): string {
    return new URL(req.url).search;
}
