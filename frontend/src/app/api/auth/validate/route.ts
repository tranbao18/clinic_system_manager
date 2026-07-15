import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { valid: false, error: "No token provided" },
        { status: 401 }
      );
    }

    const token = authHeader.split(" ")[1];

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "https://meppod.onrender.com";

    const validateRes = await fetch(`${backendUrl}/api/auth/account/dummy`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      signal: AbortSignal.timeout(3000),
    }).catch(() => null);

    if (!validateRes) {
      return NextResponse.json(
        { valid: false, error: "Backend unavailable" },
        { status: 503 }
      );
    }

    const isValid = validateRes.status !== 401 && validateRes.status !== 403;

    return NextResponse.json({ valid: isValid });
  } catch (error) {
    console.error("Token validation error:", error);
    return NextResponse.json(
      { valid: false, error: "Validation failed" },
      { status: 500 }
    );
  }
}

