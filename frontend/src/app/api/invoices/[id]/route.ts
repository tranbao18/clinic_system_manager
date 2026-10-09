import { NextRequest } from "next/server";
import { getSearch, proxyToBackend, proxyWithJsonBody } from "@/lib/backendProxy";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  return proxyToBackend({
    path: `/api/invoices/${encodeURIComponent(id)}`,
    errorMessage: "Không thể lấy thông tin hóa đơn",
  });
}

// Backend tự tính lại trạng thái từ các khoản thanh toán
export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  return proxyWithJsonBody(req, {
    path: `/api/invoices/${encodeURIComponent(id)}`,
    method: "PUT",
    errorMessage: "Không thể cập nhật hóa đơn",
  });
}

// Chuyển tiếp ?hard=true (xóa vĩnh viễn hóa đơn đã ở Thùng rác); không có query là xóa mềm
export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  return proxyToBackend({
    path: `/api/invoices/${encodeURIComponent(id)}`,
    method: "DELETE",
    search: getSearch(req),
    errorMessage: "Không thể xóa hóa đơn",
  });
}
