// KẾ THỪA
import { NextRequest, NextResponse } from "next/server";
import { getAuthHeaderServer } from "@/lib/authHeaderServer";

const API_URL = `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/employees`;

async function safeJsonParse(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (err) {
    console.error(" Response không phải JSON:", text);
    throw new Error(`Response từ backend không hợp lệ: ${res.url}`);
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const disabled = searchParams.get("disabled");

    const rawHeaders = await getAuthHeaderServer();
    const headers: Record<string, string> = {};

    if (rawHeaders?.Authorization) {
      headers.Authorization = rawHeaders.Authorization;
    }

    let url = API_URL;
    if (disabled === "true") {
      url += `?disabled=true`;
    }

    const res = await fetch(url, {
      headers,
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Backend GET error:", text);
      return NextResponse.json({ error: text }, { status: res.status });
    }

    const data = await safeJsonParse(res);
    let list = Array.isArray(data) ? data : [];

    if (disabled === "true") {
      list = list.filter((item: any) => item.disabled === true);
    } else if (disabled === "false") {
      list = list.filter((item: any) => item.disabled !== true);
    }

    return NextResponse.json(list, { status: 200 });
  } catch (error: any) {
    console.error("GET /api/employees error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawHeaders = await getAuthHeaderServer();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (rawHeaders?.Authorization) {
      headers.Authorization = rawHeaders.Authorization;
    }

    const res = await fetch(API_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(" Backend POST error:", text);
      return NextResponse.json({ error: text }, { status: res.status });
    }

    const data = await safeJsonParse(res);
    return NextResponse.json(data, { status: 200 });
  } catch (error: any) {
    console.error("POST /api/employees error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
