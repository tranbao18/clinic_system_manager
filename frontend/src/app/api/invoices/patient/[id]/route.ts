import { NextRequest } from "next/server";
import { proxyToBackend } from "@/lib/backendProxy";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyToBackend({
    path: `/api/invoices/patient/${encodeURIComponent(id)}`,
    errorMessage: "Không thể lấy hóa đơn của bệnh nhân",
    transform: (data) => (Array.isArray(data) ? data : data ? [data] : []),
  });
}
