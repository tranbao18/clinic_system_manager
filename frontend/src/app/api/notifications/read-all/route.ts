// KẾ THỪA
import { NextResponse } from "next/server";
import { getAuthHeaderServer } from "@/lib/authHeaderServer";

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "https://meppod.onrender.com";

export async function PUT(req: Request) {
  try {
    const authHeaders = await getAuthHeaderServer();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    const incomingAuth = req.headers.get("authorization") || req.headers.get("Authorization");
    if (incomingAuth) {
      headers.Authorization = incomingAuth;
    } else if (authHeaders.Authorization) {
      headers.Authorization = authHeaders.Authorization;
    }

    const url = `${API_URL}/api/notifications/read-all`;
    const res = await fetch(url, {
      method: "PUT",
      headers,
    });

    // Đọc body đúng một lần (json() rồi text() sẽ lỗi "Body is unusable")
    const text = await res.text();
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }

    if (!res.ok) {
      const body = data && typeof data === "object" && !Array.isArray(data) ? data : {};
      return NextResponse.json(
        { ...body, error: body.error || body.message || "Không thể đánh dấu tất cả đã đọc" },
        { status: res.status }
      );
    }

    return NextResponse.json(data ?? {});
  } catch (err: any) {
    console.error("PUT /api/notifications/read-all exception:", err);
    return NextResponse.json(
      { error: err.message || "Lỗi hệ thống" },
      { status: 500 }
    );
  }
}
