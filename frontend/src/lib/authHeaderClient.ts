// TỰ VIẾT
'use client';

export function getAuthHeaderClient(): Record<string, string> {
  if (typeof window === "undefined") return {};

  const token = sessionStorage.getItem("token") || localStorage.getItem("token");
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

/**
 * Safe headers getter that ensures no undefined values
 */
export function getSafeAuthHeaders(): Record<string, string> {
  const headers = getAuthHeaderClient();
  // Filter out any undefined values to ensure type safety
  const safeHeaders: Record<string, string> = {};
  Object.entries(headers).forEach(([key, value]) => {
    if (value !== undefined) {
      safeHeaders[key] = value;
    }
  });
  return safeHeaders;
}

/**
 * Handle authentication errors by redirecting to login without clearing tokens
 * This allows users to continue their session when reloading tabs
 */
export function handleAuthRedirect() {
  if (typeof window === "undefined") return;

  // Don't clear tokens - just redirect to login
  // Tokens will be validated on login page
  if (!window.location.pathname.includes("/auth/login")) {
    window.location.href = "/auth/login";
  }
}

/**
 * Clear all tokens (only called on explicit logout)
 */
export function clearAllTokens() {
  if (typeof window === "undefined") return;

  sessionStorage.removeItem("token");
  sessionStorage.removeItem("user");
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

/**
 * Validate current token with backend
 */
export async function validateCurrentToken(): Promise<boolean> {
  if (typeof window === "undefined") return false;

  const token = sessionStorage.getItem("token") || localStorage.getItem("token");
  if (!token) return false;

  try {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "https://meppod.onrender.com";
    const res = await fetch(`${backendUrl}/api/auth/validate`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });

    return res.ok;
  } catch (error) {
    console.error("Token validation failed:", error);
    return false;
  }
}
