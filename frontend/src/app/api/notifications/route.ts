// KẾ THỪA
import { NextResponse } from "next/server";
import { getAuthHeaderServer } from "@/lib/authHeaderServer";

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "https://meppod.onrender.com";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const read = searchParams.get("read");

    const authHeaders = await getAuthHeaderServer();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    // Prefer Authorization sent from client (e.g. fetch with Authorization header),
    // fallback to server-side session token.
    const incomingAuth = req.headers.get("authorization") || req.headers.get("Authorization");
    if (incomingAuth) {
      headers.Authorization = incomingAuth;
    } else if (authHeaders.Authorization) {
      headers.Authorization = authHeaders.Authorization;
    }

    const url = `${API_URL}/api/notifications${read ? `?read=${encodeURIComponent(read)}` : ""}`;
    const res = await fetch(url, {
      method: "GET",
      headers,
      cache: "no-store",
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
      console.error("External API (GET notifications) error:", { status: res.status, body: text, url });
      const body = data && typeof data === "object" && !Array.isArray(data) ? data : {};
      return NextResponse.json(
        { ...body, error: body.error || body.message || "Không thể lấy thông báo" },
        { status: res.status }
      );
    }

    return NextResponse.json(data ?? []);
  } catch (err: any) {
    console.error("GET /api/notifications exception:", err);
    return NextResponse.json(
      { error: err.message || "Lỗi hệ thống" },
      { status: 500 }
    );
  }
}
