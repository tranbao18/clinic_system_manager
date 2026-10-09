// Chỉ giữ lại các field được phép từ req.body trước khi ghi vào DB.
// Chặn mass assignment (vd: client tự gửi disabled, status: "Paid", net_salary...)
// và update-operator injection (vd: {"$set": {...}}, {"$unset": {...}}).
export default function pickFields(body, allowed) {
  const out = {};
  if (!body || typeof body !== 'object' || Array.isArray(body)) return out;
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(body, key) && body[key] !== undefined) {
      out[key] = body[key];
    }
  }
  return out;
}
