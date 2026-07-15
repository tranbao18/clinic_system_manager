// KẾ THỪA
export type User = {
    id: string;
    username: string;
    passwordHash: string;
    role?: string;
};

export async function login(username: string, passwordHash: string): Promise<User | null> {
    try {
        const res = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, passwordHash }),
        });

        const data = await res.json();
        if (!res.ok) {
            console.error("Login failed:", data.error);
            return null;
        }

        return data.user || null;
    } catch (err) {
        console.error("Login error:", err);
        return null;
    }
}

export async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
}
