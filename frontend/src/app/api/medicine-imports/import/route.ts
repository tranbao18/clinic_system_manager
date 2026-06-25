import { NextResponse } from "next/server";
import { getAuthHeaderServer } from "@/lib/authHeaderServer";

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "https://meppod.onrender.com";
const MEDICINE_IMPORTS_IMPORT_URL = `${API_URL}/api/medicine-imports/import`;


export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json(
                { error: "Không có file được chọn" },
                { status: 400 }
            );
        }

        const allowedTypes = [
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
            "application/vnd.ms-excel", // .xls
            "text/csv", // .csv
        ];
        const allowedExtensions = [".xlsx", ".xls", ".csv"];
        const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf("."));

        const isValidType =
            allowedTypes.includes(file.type) ||
            file.name.endsWith(".csv") ||
            allowedExtensions.includes(fileExtension);

        if (!isValidType) {
            console.error("Invalid file type:", file.type, "File name:", file.name);
            return NextResponse.json(
                {
                    error:
                        "Định dạng file không được hỗ trợ. Chỉ chấp nhận file Excel (.xlsx, .xls) hoặc CSV (.csv)",
                },
                { status: 400 }
            );
        }

        if (file.size > 10 * 1024 * 1024) {
            return NextResponse.json(
                { error: "File quá lớn. Kích thước tối đa là 10MB" },
                { status: 400 }
            );
        }

        const authHeaders = await getAuthHeaderServer();
        const uploadFormData = new FormData();
        uploadFormData.append("file", file);

        const headers: HeadersInit = {};
        if (authHeaders.Authorization) {
            headers.Authorization = authHeaders.Authorization;
        }

        console.log("Forwarding import request to backend:", MEDICINE_IMPORTS_IMPORT_URL);
        const res = await fetch(MEDICINE_IMPORTS_IMPORT_URL, {
            method: "POST",
            headers,
            body: uploadFormData,
        });

        console.log("Backend response status:", res.status, res.statusText);

        if (!res.ok) {
            const text = await res.text();
            let errorData;
            try {
                errorData = JSON.parse(text);
            } catch {
                errorData = { error: text || `HTTP ${res.status}: ${res.statusText}` };
            }
            console.error("External API (POST import medicine-imports) error:", res.status, errorData);
            return NextResponse.json(
                { error: errorData.error || errorData.message || "Không thể import file", detail: errorData },
                { status: res.status }
            );
        }

        let data;
        try {
            const text = await res.text();
            data = text ? JSON.parse(text) : {};
            console.log("Backend response data:", data);
        } catch (parseError) {
            console.error("Failed to parse backend response:", parseError);
            return NextResponse.json(
                { error: "Không thể đọc phản hồi từ server" },
                { status: 500 }
            );
        }

        return NextResponse.json(data);
    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "Lỗi hệ thống";
        console.error("POST /api/medicine-imports/import exception:", err);
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}

