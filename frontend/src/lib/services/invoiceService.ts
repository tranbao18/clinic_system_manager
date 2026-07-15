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
import { getAuthHeaderClient } from "@/lib/authHeaderClient";

export async function getInvoices(filters?: {
  patient_id?: string;
  appointment_id?: string;
  status?: string;
}): Promise<Invoice[]> {
  try {
    const authHeaders = await getAuthHeaderClient();
    const res = await fetch("/api/invoices", {
      cache: "no-store",
      headers: authHeaders
    });

    if (!res.ok) {
      let errorMessage = "Không thể lấy danh sách hóa đơn";
      try {
        const errorData = await res.json();
        errorMessage = errorData.error || errorData.detail || errorMessage;
        console.error("getInvoices API error:", {
          status: res.status,
          statusText: res.statusText,
          error: errorData,
        });
      } catch (e) {
        const errorText = await res.text();
        console.error("getInvoices API error (text):", {
          status: res.status,
          statusText: res.statusText,
          error: errorText,
        });
        errorMessage = errorText || errorMessage;
      }
      console.warn("⚠️ Không thể lấy danh sách hóa đơn, trả về mảng rỗng");
      return [];
    }

    let invoices = await res.json();

    if (!Array.isArray(invoices)) {
      console.warn("⚠️ Response không phải array, trả về mảng rỗng");
      return [];
    }

    if (filters) {
      if (filters.patient_id) {
        invoices = invoices.filter((inv: Invoice) => {
          const pid =
            typeof inv.patient_id === "object"
              ? inv.patient_id._id
              : inv.patient_id;
          return pid === filters.patient_id;
        });
      }
      if (filters.appointment_id) {
        invoices = invoices.filter((inv: Invoice) => {
          const aid =
            typeof inv.appointment_id === "object"
              ? inv.appointment_id._id
              : inv.appointment_id;
          return aid === filters.appointment_id;
        });
      }
      if (filters.status) {
        invoices = invoices.filter(
          (inv: Invoice) => inv.status?.trim() === filters.status
        );
      }
    }

    return invoices;
  } catch (error: any) {
    console.error("getInvoices exception:", error);
    return [];
  }
}

export async function getInvoiceById(id: string): Promise<Invoice> {
  try {
    console.log(`🔍 [getInvoiceById] Calling for invoice: ${id}`);
    const authHeaders = await getAuthHeaderClient();
    console.log(`🔑 [getInvoiceById] Auth headers:`, Object.keys(authHeaders));

    const res = await fetch(`/api/invoices/${id}`, {
      cache: "no-store",
      headers: authHeaders
    });

    console.log(`📊 [getInvoiceById] Next.js response status: ${res.status}`);

    if (!res.ok) {
      let detail = "";
      try {
        const errorData = await res.json();
        detail = errorData.error || errorData.detail || JSON.stringify(errorData);
        console.log(`❌ [getInvoiceById] Next.js error:`, detail);
      } catch (e) {
        detail = await res.text();
        console.log(`❌ [getInvoiceById] Next.js error text:`, detail);
      }
      throw new Error(detail || "Không thể lấy thông tin hóa đơn");
    }

    const data = await res.json();
    console.log(`✅ [getInvoiceById] Success, data keys:`, Object.keys(data));
    return data;
  } catch (err: any) {
    console.error("getInvoiceById error:", err);
    throw err;
  }
}

export async function getInvoicesByPatientId(
  patientId: string
): Promise<Invoice[]> {
  try {
    const authHeaders = await getAuthHeaderClient();
    const res = await fetch(`/api/invoices/patient/${patientId}`, {
      cache: "no-store",
      headers: authHeaders
    });

    if (!res.ok) {
      console.warn("getInvoicesByPatientId: Không thể lấy hóa đơn, trả về mảng rỗng");
      return [];
    }

    const data = await res.json();
    return Array.isArray(data) ? data : (data ? [data] : []);
  } catch (error: any) {
    console.error("getInvoicesByPatientId error:", error);
    return [];
  }
}

export async function getInvoiceByAppointmentId(
  appointmentId: string
): Promise<Invoice[]> {
  try {
    return await getInvoices({ appointment_id: appointmentId });
  } catch (error: any) {
    console.error("getInvoiceByAppointmentId error:", error);
    return [];
  }
}

export async function createInvoice(data: CreateInvoiceData): Promise<Invoice> {
  const authHeaders = await getAuthHeaderClient();
  const res = await fetch("/api/invoices", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Không thể tạo hóa đơn");
  }
  return res.json();
}

export async function createInvoiceFromMedicalRecord(
  data: CreateInvoiceFromMedicalRecordData
): Promise<Invoice> {
  try {
    // Include client-side Authorization header (if token stored in localStorage/sessionStorage)
    const clientHeaders: Record<string, string> = { "Content-Type": "application/json" };
    try {
      const authHdr = getAuthHeaderClient();
      if (authHdr && (authHdr as any).Authorization) {
        clientHeaders.Authorization = (authHdr as any).Authorization;
      }
    } catch {
      // ignore if window not available or other errors
    }

    const res = await fetch(`/api/invoices/from-medical-record/${data.medicalRecordId}`, {
      method: "POST",
      headers: clientHeaders,
    });

    if (!res.ok) {
      // Try to parse JSON error body, but fall back to plain text if parsing fails.
      let errorDetail = "";
      try {
        const errorData = await res.json();
        errorDetail = errorData.error || errorData.detail || JSON.stringify(errorData);
      } catch (parseErr) {
        // If JSON parsing fails, try to read as text
        try {
          const text = await res.text();
          errorDetail = text || `HTTP ${res.status} ${res.statusText}`;
        } catch {
          errorDetail = `HTTP ${res.status} ${res.statusText}`;
        }
      }

      const err = new Error(errorDetail || "Không thể tạo hóa đơn từ hồ sơ y tế");
      // attach status for downstream handlers if needed
      (err as any).status = res.status;
      throw err;
    }

    return await res.json();
  } catch (err: any) {
    console.error("createInvoiceFromMedicalRecord error:", err);
    throw err;
  }
}

export async function updateInvoice(
  id: string,
  data: Partial<CreateInvoiceData>
): Promise<Invoice> {
  const authHeaders = await getAuthHeaderClient();
  const res = await fetch(`/api/invoices/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Không thể cập nhật hóa đơn");
  }
  return res.json();
}

export async function updateInvoiceStatus(id: string): Promise<Invoice> {
  const invoice = await getInvoiceById(id);
  const { getPaymentsByInvoiceId } = await import("./paymentService");
  const payments = await getPaymentsByInvoiceId(id);

  const paidAmount = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalAmount = invoice.total_amount || 0;

  let newStatus: "Unpaid" | "Paid" | "Partial" = "Unpaid";
  if (paidAmount >= totalAmount) {
    newStatus = "Paid";
  } else if (paidAmount > 0) {
    newStatus = "Partial";
  }

  return await updateInvoice(id, { status: newStatus });
}

export async function deleteInvoice(id: string, permanent = false): Promise<void> {
  const authHeaders = await getAuthHeaderClient();
  const url = `/api/invoices/${id}` + (permanent ? "?hard=true" : "");
  const res = await fetch(url, {
    method: "DELETE",
    headers: authHeaders
  });
  if (!res.ok) {
    let detail = "";
    try {
      detail = (await res.json()).error;
    } catch {
      detail = await res.text();
    }
    throw new Error(detail || "Không thể xóa hóa đơn");
  }
}

export async function getDisabledInvoices(): Promise<Invoice[]> {
  const authHeaders = await getAuthHeaderClient();
  const res = await fetch("/api/invoices?disabled=true", {
    cache: "no-store",
    headers: authHeaders
  });
  if (!res.ok) throw new Error("Không thể lấy danh sách hóa đơn đã xóa");
  return res.json();
}

export async function restoreInvoice(id: string): Promise<Invoice> {
  const authHeaders = await getAuthHeaderClient();
  const res = await fetch(`/api/invoices/${id}/restore`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders
    },
  });
  if (!res.ok) throw new Error("Không thể khôi phục hóa đơn");
  return res.json();
}
