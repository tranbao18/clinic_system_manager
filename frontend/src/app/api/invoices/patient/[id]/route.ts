import { NextRequest, NextResponse } from "next/server";
import { getAuthHeaderServer } from "@/lib/authHeaderServer";

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "https://meppod.onrender.com";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authHeaders = await getAuthHeaderServer();
    const headers: Record<string, string> = {};
    if (authHeaders.Authorization) {
      headers.Authorization = authHeaders.Authorization;
    }

    const url = `${API_URL}/api/invoices/patient/${id}`;
    const res = await fetch(url, {
      cache: "no-store",
      headers,
    });

    if (!res.ok) {
      let errorDetail = "";
      try {
        const errorData = await res.json();
        errorDetail = errorData.error || errorData.message || JSON.stringify(errorData);
      } catch {
        const text = await res.text();
        errorDetail = text || `HTTP ${res.status} ${res.statusText}`;
      }

      console.error("External API (GET invoices by patient) error:", {
        status: res.status,
        statusText: res.statusText,
        detail: errorDetail,
        url,
      });

      if (res.status === 401 || res.status === 403) {
        console.warn("⚠️ Không có quyền truy cập invoices, trả về mảng rỗng");
        return NextResponse.json([]);
      }

      return NextResponse.json(
        { error: "Không thể lấy hóa đơn", detail: errorDetail },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(Array.isArray(data) ? data : (data ? [data] : []));
  } catch (err: any) {
    console.error("GET /api/invoices/patient/[id] exception:", err);
    return NextResponse.json(
      { error: err.message || "Lỗi hệ thống" },
      { status: 500 }
    );
  }
}
