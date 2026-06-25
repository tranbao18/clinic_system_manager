import { NextRequest, NextResponse } from "next/server";
import { getAuthHeaderServer } from "@/lib/authHeaderServer";

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "https://meppod.onrender.com";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ medicalRecordId: string }> }
) {
  try {
    const { medicalRecordId } = await params;
    const authHeaders = await getAuthHeaderServer();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (authHeaders.Authorization) {
      headers.Authorization = authHeaders.Authorization;
    }

    const url = `${API_URL}/api/invoices/from-medical-record/${medicalRecordId}`;
    const res = await fetch(url, {
      method: "POST",
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

      console.error("External API (POST invoice from medical record) error:", {
        status: res.status,
        statusText: res.statusText,
        detail: errorDetail,
        url,
      });

      return NextResponse.json(
        { error: "Không thể tạo hóa đơn từ hồ sơ y tế", detail: errorDetail },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data, { status: 201 });
  } catch (err: any) {
    console.error("POST /api/invoices/from-medical-record/[medicalRecordId] exception:", err);
    return NextResponse.json(
      { error: err.message || "Lỗi hệ thống" },
      { status: 500 }
    );
  }
}

