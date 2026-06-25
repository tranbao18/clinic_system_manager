import { getIronSession } from "iron-session";
import { sessionOptions, SessionData } from "@/lib/session";
import { NextRequest, NextResponse } from "next/server";
import { getAuthHeaderServer } from "@/lib/authHeaderServer";

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "https://meppod.onrender.com";

// TỰ VIẾT
export async function GET(req: NextRequest) {
  const res = new NextResponse();
  const session = await getIronSession<SessionData>(req, res, sessionOptions);

  if (!session.user) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  if (session.user.employee_id) {
    return NextResponse.json(session.user, {
      headers: { "Cache-Control": "no-store" },
    });
  }

  if (session.user._id) {
    try {
      const rawHeaders = await getAuthHeaderServer();
      const headers: Record<string, string> = {};

      if (rawHeaders?.Authorization) {
        headers.Authorization = rawHeaders.Authorization;
      }
      const backendRes = await fetch(
        `${API_URL}/api/users/${session.user._id}`,
        {
          cache: "no-store",
          headers,
        }
      );

      if (backendRes.ok) {
        const userData = await backendRes.json();
        if (userData.employee_id) {
          session.user.employee_id = userData.employee_id;
          await session.save();
        }
        return NextResponse.json(session.user, {
          headers: { "Cache-Control": "no-store" },
        });
      }
    } catch (error) {
      console.error("Error fetching user employee_id:", error);
    }
  }

  return NextResponse.json(session.user, {
    headers: { "Cache-Control": "no-store" },
  });
}
//