import { NextResponse } from "next/server";

// TỰ VIẾT
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const text = await response.text();

    if (!response.ok) {
      let message = text;
      try {
        const json = JSON.parse(text);
        message = json.error || message;
      } catch {
      }
      return NextResponse.json({ error: message }, { status: response.status });
    }

    const data = JSON.parse(text);
    return NextResponse.json(data);
  } catch (err: any) {
    console.error("Register API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
//