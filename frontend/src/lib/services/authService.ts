import { getAuthHeaderClient, clearAllTokens } from "@/lib/authHeaderClient";
const BASE_URL = "/api/auth";

const AuthService = {
  async registerAccountForEmployee(
    role: string,
    employee: {
      fullname: string;
      dob?: string | null;
      gender: string;
      phone: string;
      email: string;
      position: string;
      specialization?: string;
      address?: string;
    }
  ) {
    const res = await fetch(`${BASE_URL}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, employee }),
    });

    if (!res.ok) {
      let errorMessage = "Lỗi khi tạo tài khoản";
      try {
        const errorData = await res.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch {
        const text = await res.text();
        console.error("❌ Server error:", text);
        errorMessage = text || errorMessage;
      }
      throw new Error(errorMessage);
    }

    return res.json();
  },

  async login(username: string, password: string) {
    const res = await fetch(`${BASE_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();
    if (!res.ok)
      throw new Error(data.error || "Tên đăng nhập hoặc mật khẩu sai");

    sessionStorage.setItem("token", data.token);
    sessionStorage.setItem("user", JSON.stringify(data.user));

    return data.user;
  },


  async getAccountByUserId(id: string) {
    const res = await fetch(`${BASE_URL}/account/${id}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });

    if (!res.ok) throw new Error("Không thể tải thông tin tài khoản");
    return res.json();
  },

  async getEmployeeById(employeeId: string) {
    try {
      const authHeaders = getAuthHeaderClient();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (authHeaders.Authorization) {
        headers.Authorization = authHeaders.Authorization;
      }

      const res = await fetch(`${BASE_URL}/employee/${employeeId}`, {
        method: "GET",
        headers,
        cache: "no-store",
      });

      if (res.status === 404) {
        return { employee: null, user: null };
      }

      if (!res.ok) throw new Error("Lỗi server");
      return res.json();
    } catch (err) {
      console.error(err);
      return { employee: null, user: null };
    }
  },

  async logout() {
    try {
      const authHeaders = getAuthHeaderClient();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (authHeaders.Authorization) {
        headers.Authorization = authHeaders.Authorization;
      }

      const res = await fetch(`${BASE_URL}/logout`, {
        method: "POST",
        headers,
        credentials: "include",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Lỗi khi đăng xuất");
      }

      const data = await res.json();

      // Only clear tokens after successful logout
      clearAllTokens();

      return data;
    } catch (err: unknown) {
      // Clear tokens even on error to be safe
      clearAllTokens();
      throw err;
    }
  },

  async changePassword(
    userId: string,
    payload: { oldPassword: string; newPassword: string }
  ) {
    const authHeaders = getAuthHeaderClient();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (authHeaders.Authorization) {
      headers.Authorization = authHeaders.Authorization;
    }

    const res = await fetch(`/api/users/changepass/${userId}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || data.message || "Đổi mật khẩu thất bại");
    }
    return data;
  },

  async resetPassword(userId: string) {
    try {
      const authHeaders = getAuthHeaderClient();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (authHeaders.Authorization) {
        headers.Authorization = authHeaders.Authorization;
      }

      console.log("Calling reset password API for userId:", userId);
      const res = await fetch(`/api/auth/resetpass/${userId}`, {
        method: "PATCH",
        headers,
      });

      let data: any;
      try {
        data = await res.json();
      } catch {
        const text = await res.text();
        data = { error: text || "Lỗi không xác định" };
      }

      console.log("Reset password API response:", { status: res.status, data });

      if (!res.ok) {
        const errorMsg = data.error || data.message || `Reset mật khẩu thất bại (${res.status})`;
        console.error("Reset password API error:", errorMsg, data);
        throw new Error(errorMsg);
      }

      return data;
    } catch (error: any) {
      console.error("Reset password service error:", error);
      if (error.message) {
        throw error;
      }
      throw new Error(error.toString() || "Lỗi không xác định khi reset mật khẩu");
    }
  },
};

export default AuthService;
