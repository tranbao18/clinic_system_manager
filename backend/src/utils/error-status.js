// Chọn mã HTTP cho lỗi bắt được trong controller:
// lỗi do dữ liệu client (id sai định dạng, vi phạm schema, trùng khóa) -> 4xx thay vì 500
export default function errorStatus(err, fallback = 500) {
  const status = Number(err?.status);
  if (Number.isInteger(status) && status >= 400 && status < 600) return status;
  if (err?.name === 'CastError' || err?.name === 'ValidationError') return 400;
  if (err?.code === 11000) return 409;
  return fallback;
}
