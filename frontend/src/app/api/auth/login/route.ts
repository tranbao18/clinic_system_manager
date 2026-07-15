import { getIronSession } from "iron-session";
import { sessionOptions, SessionData } from "@/lib/session";
import { NextResponse } from "next/server";

// TỰ VIẾT
export async function POST(req: Request) {
  const res = new NextResponse();

  try {
    const { username, password } = await req.json();

    const backendRes = await fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/auth/login`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      }
    );

    const data = await backendRes.json();

    if (!backendRes.ok) {
      return NextResponse.json(
        { error: data.message || "Đăng nhập thất bại" },
        { status: backendRes.status }
      );
    }

    const session = await getIronSession<SessionData>(req, res, sessionOptions);
    session.user = {
      _id: data.user._id || data.user.id,
      username: data.user.username,
      role: data.user.role,
      token: data.token,
      employee_id: data.user.employee_id || undefined,
    };
    await session.save();

    return NextResponse.json(
      {
        message: "Đăng nhập thành công",
        user: session.user,
        token: data.token,
      },
      { headers: res.headers }
    );
  } catch (err: any) {
    console.error("Login route error:", err);
    return NextResponse.json(
      { error: err.message || "Lỗi hệ thống" },
      { status: 500 }
    );
  }
}
//