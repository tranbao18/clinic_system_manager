import { NextRequest, NextResponse } from "next/server";
import { getAuthHeaderServer } from "@/lib/authHeaderServer";

const API_URL = `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/auth/resetpass`;

// TỰ VIẾT
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const authHeaders = await getAuthHeaderServer();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (authHeaders.Authorization) {
      headers.Authorization = authHeaders.Authorization;
    }

    const backendUrl = `${API_URL}/${id}`;

    const res = await fetch(backendUrl, {
      method: "PATCH",
      headers,
    });

    const text = await res.text();
    let data: any;

    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text || "Lỗi không xác định từ server" };
    }

    console.log("API route: Backend response:", { status: res.status, data });

    if (!res.ok) {
      console.error("API route: Backend error response:", data);
      return NextResponse.json(
        { error: data.error || data.message || `Lỗi từ server (${res.status})` },
        { status: res.status }
      );
    }

    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    console.error("PATCH /api/auth/resetpass/[id] error:", error);
    return NextResponse.json(
      { error: error.message || "Lỗi server khi gọi API reset password" },
      { status: 500 }
    );
  }
}
//