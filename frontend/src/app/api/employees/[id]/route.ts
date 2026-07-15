import { NextRequest, NextResponse } from "next/server";
import { getAuthHeaderServer } from "@/lib/authHeaderServer";

const API_URL = `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/employees`;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authHeaders = await getAuthHeaderServer();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (authHeaders.Authorization) {
    headers.Authorization = authHeaders.Authorization;
  }

  const response = await fetch(`${API_URL}/${id}`, {
    headers,
    cache: "no-store",
  });

  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const authHeaders = await getAuthHeaderServer();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (authHeaders.Authorization) {
    headers.Authorization = authHeaders.Authorization;
  }

  const response = await fetch(`${API_URL}/${id}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(body),
  });

  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}

export async function DELETE(
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

    const { searchParams } = new URL(req.url);
    const hard = searchParams.get("hard");
    let url = `${API_URL}/${id}`;
    if (hard === "true") url += `?hard=true`;

    const response = await fetch(url, {
      method: "DELETE",
      headers,
    });

    if (!response.ok) {
      const text = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(text);
      } catch {
        errorData = { error: text || `HTTP ${response.status}: ${response.statusText}` };
      }
      return NextResponse.json(errorData, { status: response.status });
    }

    const text = await response.text();
    let data;
    try {
      data = text ? JSON.parse(text) : { message: "Xóa thành công" };
    } catch {
      data = { message: text || "Xóa thành công" };
    }

    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    console.error("DELETE /api/employees/[id] error:", error);
    return NextResponse.json(
      { error: error.message || "Lỗi khi xóa nhân viên" },
      { status: 500 }
    );
  }
}
