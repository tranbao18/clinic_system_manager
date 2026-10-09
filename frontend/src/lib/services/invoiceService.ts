import { getAuthHeaderClient, handleAuthRedirect } from "@/lib/authHeaderClient";

export interface Invoice {
  _id: string;
  patient_id:
  | string
  | { _id: string; fullname?: string; phone?: string; email?: string };
  appointment_id:
  | string
  | {
    _id: string;
    appointment_date?: string;
    status?: string;
    reason?: string;
  };
  total_amount: number;
  status: "Unpaid" | "Paid" | "Partial";
  created_at: string;
  updated_at: string;
  disabled?: boolean;
  paid_amount?: number; // Từ API khi getById
  remaining_amount?: number; // Từ API khi getById
}

export interface CreateInvoiceData {
  patient_id: string;
  appointment_id: string;
  total_amount: number;
  status?: "Unpaid" | "Paid" | "Partial";
}

export interface CreateInvoiceFromMedicalRecordData {
  medicalRecordId: string;
}

export interface ApiError extends Error {
  status?: number;
  data?: unknown;
}

// Đọc body một lần; lỗi thì ném Error kèm thông báo backend (+ status, data); 401 chuyển về trang đăng nhập
async function parseResponse<T>(res: Response, fallback: string): Promise<T> {
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    if (res.status === 401) handleAuthRedirect();
    const body = (data && typeof data === "object" ? data : {}) as { error?: unknown; message?: unknown };
    const msg =
      (typeof body.error === "string" && body.error) ||
      (typeof body.message === "string" && body.message) ||
      fallback;
    const err: ApiError = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data as T;
}

function idOf(ref: Invoice["patient_id"] | Invoice["appointment_id"] | null | undefined): string | undefined {
  if (!ref) return undefined;
  return typeof ref === "object" ? ref._id : ref;
}

export async function getInvoices(filters?: {
  patient_id?: string;
  appointment_id?: string;
  status?: string;
}): Promise<Invoice[]> {
  const res = await fetch("/api/invoices", {
    cache: "no-store",
    headers: getAuthHeaderClient(),
  });
  const data = await parseResponse<unknown>(res, "Không thể lấy danh sách hóa đơn");
  let invoices: Invoice[] = Array.isArray(data) ? data : [];

  if (filters?.patient_id) {
    invoices = invoices.filter((inv) => idOf(inv.patient_id) === filters.patient_id);
  }
  if (filters?.appointment_id) {
    invoices = invoices.filter((inv) => idOf(inv.appointment_id) === filters.appointment_id);
  }
  if (filters?.status) {
    invoices = invoices.filter((inv) => inv.status?.trim() === filters.status);
  }
  return invoices;
}

export async function getInvoiceById(id: string): Promise<Invoice> {
  const res = await fetch(`/api/invoices/${id}`, {
    cache: "no-store",
    headers: getAuthHeaderClient(),
  });
  return parseResponse<Invoice>(res, "Không thể lấy thông tin hóa đơn");
}

export async function getInvoicesByPatientId(
  patientId: string
): Promise<Invoice[]> {
  const res = await fetch(`/api/invoices/patient/${patientId}`, {
    cache: "no-store",
    headers: getAuthHeaderClient(),
  });
  // 404 = bệnh nhân chưa có hóa đơn; các lỗi khác (401/403/500) được ném ra để trang hiển thị
  if (res.status === 404) return [];
  const data = await parseResponse<unknown>(res, "Không thể lấy hóa đơn của bệnh nhân");
  return Array.isArray(data) ? data : data ? [data as Invoice] : [];
}

export async function getInvoiceByAppointmentId(
  appointmentId: string
): Promise<Invoice[]> {
  return getInvoices({ appointment_id: appointmentId });
}

export async function createInvoice(data: CreateInvoiceData): Promise<Invoice> {
  const res = await fetch("/api/invoices", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaderClient(),
    },
    body: JSON.stringify(data),
  });
  return parseResponse<Invoice>(res, "Không thể tạo hóa đơn");
}

// Lỗi 400 có thể kèm err.data.shortages (thiếu thuốc) hoặc err.data.invoice_id (đã có hóa đơn)
export async function createInvoiceFromMedicalRecord(
  data: CreateInvoiceFromMedicalRecordData
): Promise<Invoice> {
  const res = await fetch(`/api/invoices/from-medical-record/${data.medicalRecordId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaderClient(),
    },
  });
  return parseResponse<Invoice>(res, "Không thể tạo hóa đơn từ hồ sơ y tế");
}

export async function updateInvoice(
  id: string,
  data: Partial<CreateInvoiceData>
): Promise<Invoice> {
  const res = await fetch(`/api/invoices/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaderClient(),
    },
    body: JSON.stringify(data),
  });
  return parseResponse<Invoice>(res, "Không thể cập nhật hóa đơn");
}

// Backend luôn tự tính trạng thái từ các khoản thanh toán; chỉ cần gửi PUT rỗng và dùng kết quả trả về
export async function updateInvoiceStatus(id: string): Promise<Invoice> {
  return updateInvoice(id, {});
}

/** permanent = true: xóa vĩnh viễn (chỉ áp dụng cho hóa đơn đã ở Thùng rác) */
export async function deleteInvoice(id: string, permanent = false): Promise<void> {
  const url = `/api/invoices/${id}` + (permanent ? "?hard=true" : "");
  const res = await fetch(url, {
    method: "DELETE",
    headers: getAuthHeaderClient(),
  });
  await parseResponse<unknown>(
    res,
    permanent ? "Không thể xóa vĩnh viễn hóa đơn" : "Không thể xóa hóa đơn"
  );
}

export async function getDisabledInvoices(): Promise<Invoice[]> {
  const res = await fetch("/api/invoices?disabled=true", {
    cache: "no-store",
    headers: getAuthHeaderClient(),
  });
  const data = await parseResponse<unknown>(res, "Không thể lấy danh sách hóa đơn đã xóa");
  // Chỉ giữ hóa đơn thực sự đã xóa để không bao giờ thao tác "Xóa vĩnh viễn" lên hóa đơn đang hoạt động
  return (Array.isArray(data) ? (data as Invoice[]) : []).filter((inv) => inv.disabled === true);
}

export async function restoreInvoice(id: string): Promise<void> {
  const res = await fetch(`/api/invoices/${id}/restore`, {
    method: "PUT",
    headers: getAuthHeaderClient(),
  });
  await parseResponse<unknown>(res, "Không thể khôi phục hóa đơn");
}
