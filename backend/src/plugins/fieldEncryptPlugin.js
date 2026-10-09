import { encryptString, decryptString } from '../utils/crypto-field.js';

// Mã hóa các field String khi ghi (create, save, findByIdAndUpdate... đều chạy setter)
// và giải mã khi đọc (truy cập doc.field, toJSON/toObject).
// Lưu ý: .lean() và aggregate() bỏ qua getter -> nhận về chuỗi đã mã hóa;
// không dùng các field này làm điều kiện tìm kiếm (mỗi lần mã hóa cho ra chuỗi khác nhau).
export default function fieldEncryptPlugin(schema, { fields = [] } = {}) {
  for (const field of fields) {
    const path = schema.path(field);
    if (!path) throw new Error(`fieldEncryptPlugin: không có field "${field}" trong schema`);
    path.set(encryptString);
    path.get(decryptString);
  }

  // Bật getter khi serialize; giữ nguyên các option/transform sẵn có, không thêm virtual "id"
  for (const option of ['toJSON', 'toObject']) {
    schema.set(option, { ...(schema.get(option) || {}), getters: true, virtuals: false });
  }
}
