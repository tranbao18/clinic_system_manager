// KẾ THỪA
const SERVER_TIMESTAMP_KEY = "server_timestamp";
const TOKEN_KEY = "token";
const USER_KEY = "user";

/**
 * Clear tất cả tokens và storage
 */
export function clearAllTokens() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(SERVER_TIMESTAMP_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
}

/**
 * Lưu server timestamp để detect server restart
 */
export function saveServerTimestamp() {
    localStorage.setItem(SERVER_TIMESTAMP_KEY, Date.now().toString());
}

/**
 * Check xem server có restart không (dựa vào việc timestamp có được update không)
 * Nếu server không available, tất cả storage sẽ bị clear
 */
export async function checkServerStatus(): Promise<boolean> {
    try {
        const res = await fetch("/api/health", {
            method: "GET",
            cache: "no-store",
            signal: AbortSignal.timeout(2000), // 2s timeout
        });

        if (res.ok) {
            saveServerTimestamp();
            return true;
        }

        return false;
    } catch {
        return false;
    }
}

/**
 * Validate token bằng cách check với backend
 * Sử dụng /api/users/me để validate (nếu endpoint này require auth)
 */
export async function validateToken(token: string): Promise<boolean> {
    try {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "https://meppod.onrender.com";
        const res = await fetch(`${backendUrl}/api/auth/account/validate`, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
            },
            cache: "no-store",
            signal: AbortSignal.timeout(3000),
        }).catch(() => null);

        return res?.ok === true;
    } catch (error) {
        console.error("Token validation failed:", error);
        return false;
    }
}

/**
 * Initialize: Check token validity và server status khi app load
 * Đây là điểm vào để detect server restart và clear invalid tokens
 */
export async function initializeTokenCheck(): Promise<void> {
}

