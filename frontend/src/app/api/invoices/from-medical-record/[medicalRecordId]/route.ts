import { NextRequest } from "next/server";
import { proxyToBackend } from "@/lib/backendProxy";

// Lỗi 400 của backend (vd: thiếu thuốc kèm `shortages`, hóa đơn đã tồn tại kèm `invoice_id`) được giữ nguyên
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ medicalRecordId: string }> }
) {
  const { medicalRecordId } = await params;
  return proxyToBackend({
    path: `/api/invoices/from-medical-record/${encodeURIComponent(medicalRecordId)}`,
    method: "POST",
    errorMessage: "Không thể tạo hóa đơn từ hồ sơ y tế",
  });
}
