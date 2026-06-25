import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, SessionData } from "@/lib/session";

// TỰ VIẾT
export async function GET() {
    const cookieStore = await cookies();
    const session = await getIronSession<SessionData>(cookieStore, sessionOptions);

    if (!session.user) {
        return NextResponse.json({ user: null }, { status: 200 });
    }

    return NextResponse.json({ user: session.user }, { status: 200 });
}
//