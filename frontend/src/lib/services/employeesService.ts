import { getSafeAuthHeaders } from "@/lib/authHeaderClient";

const BASE_URL = `${process.env.NEXT_PUBLIC_BACKEND_URL || "https://meppod.onrender.com"}/api/employees`;

// Lấy thông điệp lỗi từ body backend (JSON {error|message}) thay vì in nguyên chuỗi JSON
function errorFromText(text: string, fallback: string): Error {
  let message = fallback;
  try {
    const body = text ? JSON.parse(text) : null;
    if (body && typeof body === "object") {
      message = body.error || body.message || fallback;
    }
  } catch {
    if (text && text.length < 300) message = `${fallback}: ${text}`;
  }
  return new Error(message);
}

const EmployeesService = {
  async getAll() {
    try {
      const res = await fetch(BASE_URL, {
        cache: "no-store",
        headers: getSafeAuthHeaders(),
      });
      const text = await res.text();
      if (!res.ok) throw errorFromText(text, "Lỗi khi tải danh sách nhân viên");
      return JSON.parse(text);
    } catch (error: any) {
      console.error("getAll error:", error.message);
      throw error;
    }
  },

  async getById(id: string) {
    try {
      const res = await fetch(`${BASE_URL}/${id}`, {
        cache: "no-store",
        headers: getSafeAuthHeaders(),
      });
      const text = await res.text();
      if (!res.ok) throw errorFromText(text, "Lỗi khi tải nhân viên");
      return JSON.parse(text);
    } catch (error: any) {
      console.error("getById error:", error.message);
      throw error;
    }
  },

  async createEmployee(data: any) {
    try {
      const res = await fetch(BASE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getSafeAuthHeaders(),
        },
        body: JSON.stringify(data),
      });

      const text = await res.text();

      if (!res.ok) {
        console.error("Backend error:", text);
        throw errorFromText(text, "Lỗi khi tạo nhân viên");
      }

      try {
        return JSON.parse(text);
      } catch (err) {
        console.error("❌ Response không phải JSON:", text);
        throw new Error("Phản hồi backend không hợp lệ (không phải JSON)");
      }
    } catch (error: any) {
      console.error("createEmployee error:", error.message);
      throw error;
    }
  },

  async updateEmployee(id: string, data: any) {
    try {
      const res = await fetch(`${BASE_URL}/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...getSafeAuthHeaders(),
        },
        body: JSON.stringify(data),
      });
      const text = await res.text();
      if (!res.ok) throw errorFromText(text, "Lỗi khi cập nhật nhân viên");
      return text ? JSON.parse(text) : {};
    } catch (error: any) {
      console.error("updateEmployee error:", error.message);
      throw error;
    }
  },

  async deleteEmployee(id: string, permanent = false) {
    try {
      const url = `${BASE_URL}/${id}` + (permanent ? "?hard=true" : "");
      const res = await fetch(url, {
        method: "DELETE",
        headers: getSafeAuthHeaders(),
      });
      const text = await res.text();
      if (!res.ok) throw errorFromText(text, "Lỗi khi xóa nhân viên");
      return text ? JSON.parse(text) : {};
    } catch (error: any) {
      console.error("deleteEmployee error:", error.message);
      throw error;
    }
  },

  async getDisabledEmployees() {
    try {
      const res = await fetch(`${BASE_URL}?disabled=true`, {
        cache: "no-store",
        headers: getSafeAuthHeaders(),
      });
      const text = await res.text();
      if (!res.ok) throw errorFromText(text, "Lỗi khi tải danh sách nhân viên đã xóa");
      return JSON.parse(text);
    } catch (error: any) {
      console.error("getDisabledEmployees error:", error.message);
      throw error;
    }
  },

  async restoreEmployee(id: string) {
    try {
      const res = await fetch(`${BASE_URL}/${id}/restore`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...getSafeAuthHeaders(),
        },
      });
      const text = await res.text();
      if (!res.ok) throw errorFromText(text, "Lỗi khi khôi phục nhân viên");
      return text ? JSON.parse(text) : {};
    } catch (error: any) {
      console.error("restoreEmployee error:", error.message);
      throw error;
    }
  },
};

export default EmployeesService;
