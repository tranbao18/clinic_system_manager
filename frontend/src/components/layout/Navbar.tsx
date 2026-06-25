// KẾ THỪA
"use client";

import { Layout, Menu } from "antd";
import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getMenuByRole } from "@/lib/menu";
import { clearAllTokens } from "@/lib/authHeaderClient";

const { Sider } = Layout;

export default function Navbar() {
    const [collapsed, setCollapsed] = useState(false);
    const [role, setRole] = useState<string>("");
    const [selectedKey, setSelectedKey] = useState<string>("");
    const pathname = usePathname();
    const router = useRouter();

    useEffect(() => {
        // Read role from sessionStorage/localStorage so each tab keeps its own session
        try {
            const userData = sessionStorage.getItem("user") || localStorage.getItem("user");
            if (userData) {
                const parsed = JSON.parse(userData);
                setRole(parsed?.role || "");
                return;
            }
        } catch (e) {
            // ignore parse errors
        }

        // Fallback: try server session (shared) only if no client session found
        fetch("/api/session")
            .then((res) => res.json())
            .then((data) => setRole(data?.user?.role || ""))
            .catch(() => {});
    }, []);

    const menuItems = getMenuByRole(role?.toLowerCase?.() || "");

    useEffect(() => {
        if (menuItems.length > 0) {
            let bestMatch = null;
            let maxLength = 0;

            for (const item of menuItems) {
                if (pathname === item.href || pathname.startsWith(item.href + "/")) {
                    if (item.href.length > maxLength) {
                        bestMatch = item;
                        maxLength = item.href.length;
                    }
                }
            }

            if (bestMatch) {
                setSelectedKey(bestMatch.key);
            } else {
                setSelectedKey("");
            }
        }
    }, [pathname, menuItems]);

    const handleMenuClick = (e: any) => {
        const clickedItem = menuItems.find((item) => item.key === e.key);
        if (clickedItem) {
            setSelectedKey(e.key);
            router.push(clickedItem.href);
        }
    };

    return (
        <Sider
            collapsible
            collapsed={collapsed}
            onCollapse={setCollapsed}
            width={260}
            collapsedWidth={80}
            className="flex flex-col min-h-screen bg-gradient-to-b from-[#021425] to-[#07263a] text-white shadow-lg"
        >
            {/* Header / brand */}
            <div
                className="flex items-center justify-between px-4 py-4 cursor-pointer select-none"
                role="button"
                tabIndex={0}
                onClick={() => setCollapsed(!collapsed)}
                onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                        setCollapsed(!collapsed);
                        e.preventDefault();
                    }
                }}
            >
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-md bg-white/10 flex items-center justify-center overflow-hidden">
                        <img
                            src="/logo_phong_kham.png"
                            alt="Logo Phòng khám"
                            className="w-full h-full object-contain"
                        />
                    </div>
                    {!collapsed && (
                        <div>
                            <div className="text-base font-bold">Phòng Khám Bảo Phát</div>
                            <div className="text-xs text-white/70">Quản lý phòng khám & thuốc</div>
                        </div>
                    )}
                </div>

                {/* Visual indicator (not a separate interactive button) */}

            </div>

            {/* Menu area */}
            <div className="px-2">
                <Menu
                    theme="dark"
                    mode="inline"
                    className="bg-transparent"
                    items={menuItems.map((item) => ({
                        key: item.key,
                        icon: item.icon,
                        label: !collapsed ? item.label : "",
                    }))}
                    selectedKeys={[selectedKey]}
                    onClick={handleMenuClick}
                />
            </div>

            <div className="mt-auto px-4 py-4 border-t border-white/5">
                {!collapsed ? (
                    <div className="flex items-center justify-between">
                        <div className="text-sm text-white/80">Phiên làm việc</div>
                        <button
                        onClick={() => {
                                try {
                                    // Clear client-side tokens and user data for this tab
                                    localStorage.removeItem("token");
                                    localStorage.removeItem("user");
                                    sessionStorage.removeItem("token");
                                    sessionStorage.removeItem("user");
                                    // Also clear any global token store if provided
                                    try { clearAllTokens(); } catch (e) {}
                                } catch (e) { }
                                router.push("/auth/login");
                            }}
                            className="text-xs bg-white/10 px-3 py-1 rounded hover:bg-white/20"
                        >
                            Đăng xuất
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center justify-center">
                        <button
                        onClick={() => {
                                try {
                                    localStorage.removeItem("token");
                                    localStorage.removeItem("user");
                                    sessionStorage.removeItem("token");
                                    sessionStorage.removeItem("user");
                                    try { clearAllTokens(); } catch (e) {}
                                } catch (e) { }
                                router.push("/auth/login");
                            }}
                            className="p-2 rounded hover:bg-white/5"
                            title="Đăng xuất"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                                <path d="M16 17l5-5-5-5" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="M21 12H9" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="M9 19H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h3" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </button>
                    </div>
                )}
            </div>
        </Sider>
    );
}
