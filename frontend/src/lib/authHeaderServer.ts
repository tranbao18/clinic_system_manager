// TỰ VIẾT
'use server';

import { getIronSession } from "iron-session";
import { sessionOptions, SessionData } from "@/lib/session";
import { cookies, headers } from "next/headers";

export async function getAuthHeaderServer() {
  // First check for Authorization header in the current request (from client services)
  try {
    const hdrs: any = await headers();
    const authHeader = hdrs.get?.("authorization") || hdrs.get?.("Authorization");
    if (authHeader) {
      return { Authorization: authHeader };
    }
  } catch (e) {
    // ignore
  }

  // Fallback to iron-session stored token (cookie)
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions);

  const token = session?.user?.token;
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}
