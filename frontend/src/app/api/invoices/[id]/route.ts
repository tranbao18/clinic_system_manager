import { NextRequest, NextResponse } from "next/server";
import { getAuthHeaderServer } from "@/lib/authHeaderServer";

const API_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "https://meppod.onrender.com";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    console.log(`🔍 [GET /api/invoices/${id}] Incoming request`);

    // Get auth header from the incoming request
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    const headers: Record<string, string> = {};

    console.log(`🔑 [GET /api/invoices/${id}] Auth header:`, authHeader ? 'Present' : 'Missing');

    if (!authHeader) {
      console.log(`❌ [GET /api/invoices/${id}] No auth header provided`);
      return NextResponse.json(
        { error: "Không có quyền truy cập - thiếu token xác thực" },
        { status: 401 }
      );
    }

    headers.Authorization = authHeader;
    console.log(`✅ [GET /api/invoices/${id}] Using auth header from request`);

    const url = `${API_URL}/api/invoices/${id}`;

    console.log(`🌐 [GET /api/invoices/${id}] Calling backend: ${url}`);
    console.log(`🔑 [GET /api/invoices/${id}] Headers sent:`, headers);

    const res = await fetch(url, {
      cache: "no-store",
      headers,
    });

    console.log(`📊 [GET /api/invoices/${id}] Backend response status: ${res.status}`);

    if (!res.ok) {
      const text = await res.text();
      console.log(`❌ [GET /api/invoices/${id}] Backend error:`, text);
      return NextResponse.json(
        { error: "Không thể lấy thông tin hóa đơn", detail: text },
        { status: res.status }
      );
    }

    const data = await res.json();
    console.log(`✅ [GET /api/invoices/${id}] Success, data keys:`, Object.keys(data));
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Lỗi hệ thống" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    // Get auth header from the incoming request
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (!authHeader) {
      return NextResponse.json(
        { error: "Không có quyền truy cập - thiếu token xác thực" },
        { status: 401 }
      );
    }

    headers.Authorization = authHeader;

    const body = await req.json();
    const url = `${API_URL}/api/invoices/${id}`;

    const res = await fetch(url, {
      method: "PUT",
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: "Không thể cập nhật hóa đơn", detail: text },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Lỗi hệ thống" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    // Get auth header from the incoming request
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    const headers: Record<string, string> = {};

    if (!authHeader) {
      return NextResponse.json(
        { error: "Không có quyền truy cập - thiếu token xác thực" },
        { status: 401 }
      );
    }

    headers.Authorization = authHeader;

    const url = `${API_URL}/api/invoices/${id}`;

    const res = await fetch(url, {
      method: "DELETE",
      headers,
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: "Không thể xóa hóa đơn", detail: text },
        { status: res.status }
      );
    }

    return NextResponse.json({ message: "Deleted" });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Lỗi hệ thống" },
      { status: 500 }
    );
  }
}
