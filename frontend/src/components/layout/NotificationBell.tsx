// KẾ THỪA
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { BellOutlined } from "@ant-design/icons";
import { Badge, Dropdown, Spin, Button, Empty } from "antd";
import type { MenuProps } from "antd";
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  type Notification
} from "@/lib/services/notificationService";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";

// Chỉ dùng polling (không SSE do chạy serverless)
const POLL_INTERVAL_MS = 30000;

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const mountedRef = useRef(true);
  // Số thứ tự request và số lần thay đổi trạng thái đọc: response cũ về sau "đánh dấu đã đọc" sẽ bị bỏ qua
  const requestSeqRef = useRef(0);
  const mutationSeqRef = useRef(0);

  const fetchNotifications = useCallback(async () => {
    const seq = ++requestSeqRef.current;
    const mutationAtStart = mutationSeqRef.current;
    try {
      setLoading(true);
      const [notifs, count] = await Promise.all([
        getNotifications(),
        getUnreadCount(),
      ]);
      const isStale =
        !mountedRef.current ||
        seq !== requestSeqRef.current ||
        mutationAtStart !== mutationSeqRef.current;
      if (isStale) return;
      setNotifications(notifs);
      setUnreadCount(count);
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      if (mountedRef.current && seq === requestSeqRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchNotifications();

    const intervalId = setInterval(() => {
      fetchNotifications();
    }, POLL_INTERVAL_MS);

    return () => {
      mountedRef.current = false;
      clearInterval(intervalId);
    };
  }, [fetchNotifications]);

  useEffect(() => {
    if (open) {
      fetchNotifications();
    }
  }, [open, fetchNotifications]);

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.read) {
      mutationSeqRef.current++;
      try {
        await markAsRead(notification._id);
        mutationSeqRef.current++;
        setNotifications((prev) =>
          prev.map((n) =>
            n._id === notification._id ? { ...n, read: true } : n
          )
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch (error) {
        console.error("Error marking notification as read:", error);
      }
    }

    if (notification.related_type && notification.related_id) {
      setOpen(false);
      if (notification.related_type === "appointment") {
        router.push(`/dashboard/appointments`);
      } else if (notification.related_type === "medical_record") {
        router.push(`/dashboard/patients`);
      } else if (notification.related_type === "invoice") {
        router.push(`/dashboard/invoices/${notification.related_id}`);
      }
    }
  };

  const handleMarkAllAsRead = async () => {
    // Tăng trước và sau khi gọi API: mọi response bắt đầu trước khi server cập nhật xong đều bị bỏ qua
    mutationSeqRef.current++;
    try {
      await markAllAsRead();
      mutationSeqRef.current++;
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  };

  const getNotificationIcon = (type: Notification["type"]) => {
    switch (type) {
      case "appointment_created":
        return "📅";
      case "appointment_completed":
        return "✅";
      case "medical_record_created":
        return "📋";
      case "invoice_created":
        return "💰";
      case "payment_created":
        return "💳";
      case "schedule_updated":
        return "📌";
      default:
        return "🔔";
    }
  };

  const formatTime = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), {
        addSuffix: true,
        locale: vi,
      });
    } catch {
      return dateString;
    }
  };

  const menuItems: MenuProps["items"] = [
    ...(notifications.length > 0 && unreadCount > 0
      ? [
        {
          key: "mark-all-read",
          label: (
            <Button
              type="link"
              size="small"
              onClick={handleMarkAllAsRead}
              style={{ width: "100%", textAlign: "center", padding: 0 }}
            >
              Đánh dấu tất cả đã đọc
            </Button>
          ),
        },
        { type: "divider" as const },
      ]
      : []),
    ...notifications.slice(0, 10).map((notification) => ({
      key: notification._id,
      label: (
        <div
          onClick={() => handleNotificationClick(notification)}
          style={{
            padding: "8px 0",
            cursor: "pointer",
            backgroundColor: notification.read ? "transparent" : "#e6f7ff",
            borderRadius: "4px",
            paddingLeft: "8px",
            paddingRight: "8px",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
            <span style={{ fontSize: "18px" }}>
              {getNotificationIcon(notification.type)}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontWeight: notification.read ? "normal" : "bold",
                  fontSize: "14px",
                  marginBottom: "4px",
                }}
              >
                {notification.title}
              </div>
              <div
                style={{
                  fontSize: "12px",
                  color: "#666",
                  marginBottom: "4px",
                  wordBreak: "break-word",
                }}
              >
                {notification.message}
              </div>
              <div style={{ fontSize: "11px", color: "#999" }}>
                {formatTime(notification.created_at)}
              </div>
            </div>
            {!notification.read && (
              <div
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  backgroundColor: "#1890ff",
                  marginTop: "6px",
                  flexShrink: 0,
                }}
              />
            )}
          </div>
        </div>
      ),
    })),
    ...(notifications.length === 0
      ? [
        {
          key: "empty",
          label: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="Không có thông báo"
              style={{ padding: "20px 0" }}
            />
          ),
        },
      ]
      : []),
  ];

  return (
    <Dropdown
      menu={{ items: menuItems }}
      trigger={["click"]}
      open={open}
      onOpenChange={setOpen}
      placement="bottomRight"
      overlayStyle={{ width: "400px", maxHeight: "100vh", overflowY: "auto" }}
    >
      <div
        style={{
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          padding: "0 12px",
        }}
      >
        <Badge count={unreadCount} size="small" offset={[-5, 5]}>
          <BellOutlined
            style={{ fontSize: "20px", color: "#666" }}
            spin={loading}
          />
        </Badge>
      </div>
    </Dropdown>
  );
}
