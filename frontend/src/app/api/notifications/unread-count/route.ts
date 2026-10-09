// KẾ THỪA
import { NextResponse } from "next/server";
import { getAuthHeaderServer } from "@/lib/authHeaderServer";

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "https://meppod.onrender.com";

export async function GET(req: Request) {
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

    const url = `${API_URL}/api/notifications/unread-count`;
    const res = await fetch(url, {
      method: "GET",
      headers,
      cache: "no-store",
    });

    // Đọc body một lần; trả nguyên status lỗi để client biết phiên hết hạn (401) thay vì nhận 200 {count: 0}
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
        { ...body, error: body.error || body.message || "Không thể lấy số thông báo chưa đọc", count: 0 },
        { status: res.status }
      );
    }

    return NextResponse.json(data ?? { count: 0 });
  } catch (err: any) {
    console.error("GET /api/notifications/unread-count exception:", err);
    return NextResponse.json({ error: err.message || "Lỗi hệ thống", count: 0 }, { status: 500 });
  }
}
