import { NextResponse } from "next/server";
import { getAuthHeaderServer } from "@/lib/authHeaderServer";

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "https://meppod.onrender.com";
const UPDATE_QUANTITIES_URL = `${API_URL}/api/medicine-imports/update-quantities`;

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json({ error: "Không có file được chọn" }, { status: 400 });
        }

        const allowedTypes = [
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.ms-excel",
            "text/csv",
        ];
        const allowedExtensions = [".xlsx", ".xls", ".csv"];
        const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf("."));
        const isValidType =
            allowedTypes.includes(file.type) || file.name.endsWith(".csv") || allowedExtensions.includes(fileExtension);
        if (!isValidType) {
            return NextResponse.json(
                { error: "Định dạng file không được hỗ trợ. Chỉ chấp nhận file Excel (.xlsx, .xls) hoặc CSV (.csv)" },
                { status: 400 }
            );
        }

        if (file.size > 10 * 1024 * 1024) {
            return NextResponse.json({ error: "File quá lớn. Kích thước tối đa là 10MB" }, { status: 400 });
        }

        const authHeaders = await getAuthHeaderServer();
        const uploadFormData = new FormData();
        uploadFormData.append("file", file);

        const headers: HeadersInit = {};
        if (authHeaders.Authorization) headers.Authorization = authHeaders.Authorization;

        console.log("Forwarding update-quantities request to backend:", UPDATE_QUANTITIES_URL);
        const res = await fetch(UPDATE_QUANTITIES_URL, {
            method: "POST",
            headers,
            body: uploadFormData,
        });

        console.log("Backend response status:", res.status, res.statusText);
        const text = await res.text();
        let data: any = {};
        try {
            data = text ? JSON.parse(text) : {};
        } catch {
            data = { __raw: text };
        }

        if (!res.ok) {
            console.error("External API (POST update-quantities) error:", res.status, data);
            return NextResponse.json(
                { error: data.error || data.message || data.__raw || `HTTP ${res.status}` },
                { status: res.status }
            );
        }

        return NextResponse.json(data);
    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "Lỗi hệ thống";
        console.error("POST /api/medicine-imports/update-quantities exception:", err);
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}


