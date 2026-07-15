export interface Notification {
  _id: string;
  recipient_id: string;
  recipient_role: string;
  type: 'appointment_created' | 'medical_record_created' | 'invoice_created' | 'payment_created' | 'appointment_completed' | 'schedule_updated';
  title: string;
  message: string;
  related_id?: string;
  related_type?: string;
  read: boolean;
  created_at: string;
  updated_at: string;
}

export interface NotificationCount {
  count: number;
}

import { handleAuthRedirect } from "@/lib/authHeaderClient";

export async function getNotifications(read?: boolean): Promise<Notification[]> {
  const params = new URLSearchParams();
  if (read !== undefined) {
    params.append('read', read.toString());
  }

  const token = typeof window !== "undefined" ? (sessionStorage.getItem("token") || localStorage.getItem("token")) : null;
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  // Debug: log token presence and request URL
  try {
    console.debug('🔍 [notificationService] getNotifications', { tokenPresent: !!token, url: `/api/notifications?${params.toString()}` });
  } catch (e) { }

  const res = await fetch(`/api/notifications?${params.toString()}`, {
    cache: "no-store",
    credentials: "include",
    headers,
  });

  if (!res.ok) {
    if (res.status === 401) {
      handleAuthRedirect();
      throw new Error("Phiên đăng nhập đã hết hạn");
    }
    const error = await res.json().catch(() => ({ error: "Không thể lấy thông báo" }));
    throw new Error(error.error || "Không thể lấy thông báo");
  }

  return res.json();
}

export async function getUnreadCount(): Promise<number> {
  const token = typeof window !== "undefined" ? (sessionStorage.getItem("token") || localStorage.getItem("token")) : null;
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    console.debug('🔍 [notificationService] getUnreadCount', { tokenPresent: !!token, url: "/api/notifications/unread-count" });
  } catch (e) { }

  const res = await fetch("/api/notifications/unread-count", {
    cache: "no-store",
    credentials: "include",
    headers,
  });

  if (!res.ok) {
    if (res.status === 401) {
      handleAuthRedirect();
      return 0;
    }
    return 0; // Trả về 0 nếu có lỗi
  }

  const data: NotificationCount = await res.json();
  return data.count || 0;
}

export async function markAsRead(notificationId: string): Promise<Notification> {
  const token = typeof window !== "undefined" ? (sessionStorage.getItem("token") || localStorage.getItem("token")) : null;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api/notifications/${notificationId}/read`, {
    method: "PUT",
    headers,
    credentials: "include",
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Không thể đánh dấu đã đọc" }));
    throw new Error(error.error || "Không thể đánh dấu đã đọc");
  }

  return res.json();
}

export async function markAllAsRead(): Promise<void> {
  const token = typeof window !== "undefined" ? (sessionStorage.getItem("token") || localStorage.getItem("token")) : null;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch("/api/notifications/read-all", {
    method: "PUT",
    headers,
    credentials: "include",
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Không thể đánh dấu tất cả đã đọc" }));
    throw new Error(error.error || "Không thể đánh dấu tất cả đã đọc");
  }
}

export async function deleteNotification(notificationId: string): Promise<void> {
  const token = typeof window !== "undefined" ? (sessionStorage.getItem("token") || localStorage.getItem("token")) : null;
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api/notifications/${notificationId}`, {
    method: "DELETE",
    credentials: "include",
    headers,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Không thể xóa thông báo" }));
    throw new Error(error.error || "Không thể xóa thông báo");
  }
}
