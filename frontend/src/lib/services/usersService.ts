import { getAuthHeaderServer } from "@/lib/authHeaderServer";
import { getSafeAuthHeaders } from "@/lib/authHeaderClient";

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "https://meppod.onrender.com";
const API_URL = `${BASE_URL}/api/users`;

async function getAuthHeaders() {
  if (typeof window === "undefined") {
    const headers = await getAuthHeaderServer();
    // Filter out undefined values for server-side
    const safeHeaders: Record<string, string> = {};
    if (headers.Authorization) {
      safeHeaders.Authorization = headers.Authorization;
    }
    return safeHeaders;
  } else {
    return getSafeAuthHeaders();
  }
}

const UsersService = {
  async getByUserId(userId: string) {
    try {
      const headers = {
        "Content-Type": "application/json",
        ...getSafeAuthHeaders(),
      };

      console.log(
        "🔗 Fetching user:",
        `${BASE_URL}/api/auth/account/${userId}`
      );

      const resUser = await fetch(`${BASE_URL}/api/auth/account/${userId}`, {
        method: "GET",
        headers,
        cache: "no-store",
      });

      if (!resUser.ok) {
        const text = await resUser.text();
        console.error("Fetch user failed:", text);
        throw new Error("Không thể lấy thông tin user");
      }

      const { user, employee } = await resUser.json();

      return { user, employee };
    } catch (err) {
      console.error(err);
      return { user: null, employee: null };
    }
  },
  async getById(id: string) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_URL}/${id}`, {
      headers,
      cache: "no-store",
    });

    if (!response.ok) throw new Error("Không thể tải thông tin người dùng");
    return response.json();
  },

  async create(data: any) {
    const headers = await getAuthHeaders();
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) throw new Error("Không thể tạo tài khoản");
    return response.json();
  },

  async update(id: string, data: any) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_URL}/${id}`, {
      method: "PUT",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) throw new Error("Không thể cập nhật tài khoản");
    return response.json();
  },
  async updateAccount(userId: string, employeeData: any) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${BASE_URL}/api/auth/account/${userId}`, {
      method: "PUT",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(employeeData),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || "Không thể cập nhật thông tin cá nhân");
    }
    return response.json();
  },

  async delete(id: string) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_URL}/${id}`, {
      method: "DELETE",
      headers,
    });

    if (!response.ok) throw new Error("Không thể xóa tài khoản");
    return response.json();
  },
};

export default UsersService;
