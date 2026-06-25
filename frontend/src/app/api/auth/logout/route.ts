import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, SessionData } from "@/lib/session";

// TỰ VIẾT
export async function POST(req: Request) {
    const res = new NextResponse();

    try {
        const session = await getIronSession<SessionData>(req, res, sessionOptions);
        const token = session.user?.token;

        if (token) {
            const backendRes = await fetch(
                `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/auth/logout`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            if (!backendRes.ok) {
                const data = await backendRes.json().catch(() => ({}));
                console.error("Backend logout error:", data);
            }
        }

        session.destroy();

        return NextResponse.json(
            { success: true, message: "Đăng xuất thành công" },
            { headers: res.headers }
        );
    } catch (err: unknown) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error("Logout route error:", err);

        try {
            const session = await getIronSession<SessionData>(req, res, sessionOptions);
            session.destroy();
        } catch {
        }

        return NextResponse.json(
            { error: error.message || "Lỗi khi đăng xuất" },
            { status: 500, headers: res.headers }
        );
    }
}
//