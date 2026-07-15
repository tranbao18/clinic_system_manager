// src/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";


export async function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;

    console.log("🔍 Middleware running at:", pathname);

    if (pathname === "/") {
        return NextResponse.redirect(new URL("/auth/login", req.url));
    }

    if (
        pathname.startsWith("/_next") ||
        pathname === "/favicon.ico" ||
        pathname.startsWith("/auth") ||
        pathname.startsWith("/api/auth")
    ) {
        return NextResponse.next();
    }

    const sessionCookie = req.cookies.get("clinic_session");

    if (!sessionCookie) {
        return NextResponse.redirect(new URL("/auth/login", req.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
