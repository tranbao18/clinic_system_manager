import { NextRequest, NextResponse } from "next/server";
import { getAuthHeaderServer } from "@/lib/authHeaderServer";

const API_URL = `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/employees`;

// Đọc body đúng một lần; body lỗi không phải JSON vẫn trả JSON có `error` và đúng status
async function relay(response: Response, fallbackError: string, emptyBody: Record<string, unknown> = {}) {
  const text = await response.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    const body = data && typeof data === "object" && !Array.isArray(data) ? data : {};
    return NextResponse.json(
      {
        ...body,
        error: body.error || body.message || fallbackError,
        ...(data === null && text ? { detail: text.slice(0, 500) } : {}),
      },
      { status: response.status }
    );
  }

  if (data === null && text) data = { message: text };
  // 204 không được có body
  return NextResponse.json(data ?? emptyBody, { status: response.status === 204 ? 200 : response.status });
}

async function buildHeaders(): Promise<Record<string, string>> {
  const authHeaders = await getAuthHeaderServer();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (authHeaders.Authorization) {
    headers.Authorization = authHeaders.Authorization;
  }
  return headers;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const response = await fetch(`${API_URL}/${id}`, {
      headers: await buildHeaders(),
      cache: "no-store",
    });
    return relay(response, "Không tìm thấy nhân viên");
  } catch (error: any) {
    console.error("GET /api/employees/[id] error:", error);
    return NextResponse.json({ error: error.message || "Lỗi hệ thống" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const response = await fetch(`${API_URL}/${id}`, {
      method: "PUT",
      headers: await buildHeaders(),
      body: JSON.stringify(body),
    });
    return relay(response, "Không thể cập nhật nhân viên");
  } catch (error: any) {
    console.error("PUT /api/employees/[id] error:", error);
    return NextResponse.json({ error: error.message || "Lỗi hệ thống" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const hard = searchParams.get("hard");
    let url = `${API_URL}/${id}`;
    if (hard === "true") url += `?hard=true`;

    const response = await fetch(url, {
      method: "DELETE",
      headers: await buildHeaders(),
    });
    return relay(response, "Lỗi khi xóa nhân viên", { message: "Xóa thành công" });
  } catch (error: any) {
    console.error("DELETE /api/employees/[id] error:", error);
    return NextResponse.json(
      { error: error.message || "Lỗi khi xóa nhân viên" },
      { status: 500 }
    );
  }
}
