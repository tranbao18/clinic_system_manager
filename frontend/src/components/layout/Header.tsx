// KẾ THỪA
"use client";

import { Layout } from "antd";
import { Avatar } from "antd";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { useEffect, useState } from "react";
import { UserOutlined } from "@ant-design/icons";
import AuthService from "@/lib/services/authService";
import NotificationBell from "./NotificationBell";

const { Header: AntHeader } = Layout;

export default function Header() {
  const router = useRouter();
  const [user, setUser] = useState<{ username?: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        // Get user data from sessionStorage instead of API to maintain per-tab sessions
        const userData = sessionStorage.getItem("user") || localStorage.getItem("user");
        if (!userData) {
          throw new Error("Chưa đăng nhập");
        }
        const data = JSON.parse(userData);
        setUser(data);
      } catch (err) {
        console.error(err);
        router.push("/auth/login");
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [router]);

  const handleLogout = async () => {
    try {
      await AuthService.logout();

      await fetch("/auth/logout", {
        method: "POST",
        credentials: "include",
      });

      router.push("/auth/login");
    } catch (err) {
      console.error("Logout failed", err);
      router.push("/auth/login");
    }
  };

  if (loading) return null;

  return (
    <AntHeader className="bg-white flex justify-between items-center px-4 shadow">
      <div className="flex items-center gap-4"></div>

      <div className="flex items-center gap-4">
        <NotificationBell />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div className="flex items-center gap-2 cursor-pointer">
              <Avatar
                size={36}
                className="bg-gray-500"
                icon={<UserOutlined />}
              />
              <span>{user?.username || "User"}</span>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => router.push("/dashboard/profile")}>
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleLogout}>Logout</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </AntHeader>
  );
}
