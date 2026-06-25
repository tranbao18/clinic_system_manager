import { NextRequest, NextResponse } from "next/server";
import { getAuthHeaderServer } from "@/lib/authHeaderServer";

const API_URL = `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/auth/employee`;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params; // ✅ phải await trong Next.js 15
    const authHeaders = await getAuthHeaderServer();

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (authHeaders.Authorization) {
      headers.Authorization = authHeaders.Authorization;
    }

    const res = await fetch(`${API_URL}/${id}`, {
      headers,
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("❌ Backend GET error:", text);
      return NextResponse.json({ error: text }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    console.error("GET /api/auth/employee/[id] error:", error);
    return NextResponse.json(
      { error: error.message || "Lỗi server" },
      { status: 500 }
    );
  }
}

