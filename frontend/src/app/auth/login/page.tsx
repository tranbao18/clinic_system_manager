// KẾ THỪA
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { notification, Modal } from "antd";

export default function LoginPage() {
  const [username, setUserName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const [api, contextHolder] = notification.useNotification();

  const [forgotPasswordModalVisible, setForgotPasswordModalVisible] = useState(false);
  const [forgotUsername, setForgotUsername] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

  const handleLogin = async () => {
    if (!username || !password) {
      api.warning({
        message: "Thiếu thông tin",
        description: "Vui lòng nhập đầy đủ username và password",
      });
      return;
    }

    setLoading(true);
    try {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      sessionStorage.removeItem("token");
      sessionStorage.removeItem("user");

      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        api.error({
          message: "Đăng nhập thất bại",
          description: data.error || "Tên đăng nhập hoặc mật khẩu không đúng",
        });
        return;
      }

      sessionStorage.setItem("token", data.token);
      sessionStorage.setItem("user", JSON.stringify(data.user));

      api.success({
        message: "Đăng nhập thành công 🎉",
        description: `Xin chào ${data.user.username}, chào mừng bạn quay lại hệ thống!`,
      });

      router.push("/dashboard");
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      api.error({
        message: "Lỗi hệ thống",
        description: error.message || "Có lỗi xảy ra khi đăng nhập",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!forgotUsername || !forgotEmail) {
      api.warning({
        message: "Thiếu thông tin",
        description: "Vui lòng nhập đầy đủ username và email",
      });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(forgotEmail)) {
      api.warning({
        message: "Email không hợp lệ",
        description: "Vui lòng nhập địa chỉ email đúng định dạng",
      });
      return;
    }

    setForgotLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: forgotUsername, email: forgotEmail }),
      });

      const data = await res.json();

      if (!res.ok) {
        api.error({
          message: "Không thể gửi email",
          description: data.error || "Có lỗi xảy ra khi gửi email khôi phục mật khẩu",
        });
        return;
      }

      api.success({
        message: "Email đã được gửi",
        description: "Vui lòng kiểm tra hộp thư để nhận hướng dẫn khôi phục mật khẩu",
      });

      setForgotPasswordModalVisible(false);
      setForgotUsername("");
      setForgotEmail("");

    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      api.error({
        message: "Lỗi hệ thống",
        description: error.message || "Có lỗi xảy ra khi gửi yêu cầu",
      });
    } finally {
      setForgotLoading(false);
    }
  };

  const handleForgotPasswordModalClose = () => {
    setForgotPasswordModalVisible(false);
    setForgotUsername("");
    setForgotEmail("");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#dff6ff] via-[#f7fcff] to-[#e8fff1] relative overflow-hidden">
      {contextHolder}

      {/* Decorative background elements */}
      <svg
        className="absolute -left-10 -top-10 opacity-20 w-72 h-72"
        viewBox="0 0 200 200"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <defs>
          <linearGradient id="g1" x1="0" x2="1">
            <stop offset="0%" stopColor="#7dd3fc" />
            <stop offset="100%" stopColor="#60a5fa" />
          </linearGradient>
        </defs>
        <circle cx="100" cy="100" r="80" fill="url(#g1)" />
      </svg>

      <div className="relative z-10 w-full max-w-5xl mx-4 rounded-3xl shadow-xl overflow-hidden grid grid-cols-1 md:grid-cols-2 bg-white">
        {/* Left hero - clinic themed */}
        <div className="hidden md:flex flex-col items-center justify-center gap-6 p-10 bg-gradient-to-b from-[#0ea5a4] to-[#60a5fa] text-white">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-white/20 p-3">
              {/* Simple stethoscope + cross icon */}
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M12 2v6" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M8 8a4 4 0 1 0 8 0v6a4 4 0 1 1-8 0V8z" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                <rect x="16.5" y="3.5" width="4" height="4" rx="1" fill="white" opacity="0.95" />
              </svg>
            </div>
            <div>
              <h3 className="text-2xl font-bold">Phòng khám Tự động</h3>
              <p className="text-sm opacity-90">Quản lý khám chữa bệnh & dược phẩm</p>
            </div>
          </div>

          <div className="text-center px-6">
            <p className="opacity-95">
              Truy cập nhanh hồ sơ bệnh nhân, lịch khám và kho thuốc — an toàn, bảo mật và trực quan.
            </p>
          </div>
        </div>

        {/* Right - login form */}
        <div className="p-8 md:p-12">
          <div className="max-w-md mx-auto">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-lg flex items-center justify-center text-white overflow-hidden bg-white/5">
                <img
                  src="/logo_phong_kham.png"
                  alt="Logo Phòng khám"
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <h2 className="text-2xl font-semibold">Đăng nhập hệ thống</h2>
                <p className="text-sm text-gray-500">Nhập thông tin tài khoản phòng khám để tiếp tục</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="username" className="text-sm text-gray-600 block mb-1">Tên đăng nhập</label>
                <input
                  id="username"
                  type="text"
                  className="w-full mt-1 p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#60a5fa]"
                  value={username}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="Nhập tên đăng nhập"
                  aria-label="username"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label htmlFor="password" className="text-sm text-gray-600">Mật khẩu</label>
                  <button
                    type="button"
                    onClick={() => setForgotPasswordModalVisible(true)}
                    className="text-sm text-[#60a5fa] hover:text-[#089191] hover:underline bg-transparent border-none p-0 cursor-pointer"
                  >
                    Quên mật khẩu?
                  </button>
                </div>
                <input
                  id="password"
                  type="password"
                  className="w-full mt-1 p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#60a5fa]"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••"
                  aria-label="password"
                />
              </div>
              <button
                onClick={handleLogin}
                disabled={loading}
                className="w-full bg-[#0ea5a4] text-white py-3 rounded-lg hover:bg-[#089191] disabled:opacity-60"
              >
                {loading ? "Đang xử lý..." : "Đăng nhập"}
              </button>
            </div>
          </div>
        </div>
      </div>


      <Modal
        title={
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white overflow-hidden bg-[#0ea5a4]">
              <img
                src="/logo_phong_kham.png"
                alt="Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <h3 className="text-lg font-semibold m-0">Quên mật khẩu</h3>
            </div>
          </div>
        }
        open={forgotPasswordModalVisible}
        onCancel={handleForgotPasswordModalClose}
        footer={null}
        centered
        width={400}
      >
        <div className="py-4">
          <p className="text-sm text-gray-600 mb-4">
            Nhập username và email của bạn để nhận hướng dẫn khôi phục mật khẩu.
          </p>

          <div className="space-y-4">
            <div>
              <label htmlFor="forgot-username" className="text-sm text-gray-600 block mb-1">
                Tên đăng nhập
              </label>
              <input
                id="forgot-username"
                type="text"
                className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#60a5fa]"
                value={forgotUsername}
                onChange={(e) => setForgotUsername(e.target.value)}
                placeholder="Nhập tên đăng nhập"
              />
            </div>

            <div>
              <label htmlFor="forgot-email" className="text-sm text-gray-600 block mb-1">
                Địa chỉ email
              </label>
              <input
                id="forgot-email"
                type="email"
                className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#60a5fa]"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                placeholder="Nhập địa chỉ email"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleForgotPassword}
                disabled={forgotLoading}
                className="flex-1 bg-[#0ea5a4] text-white py-2 px-4 rounded-lg hover:bg-[#089191] disabled:opacity-60 text-sm font-medium"
              >
                {forgotLoading ? "Đang gửi..." : "Gửi yêu cầu"}
              </button>
              <button
                onClick={handleForgotPasswordModalClose}
                className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-300 text-sm font-medium"
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
