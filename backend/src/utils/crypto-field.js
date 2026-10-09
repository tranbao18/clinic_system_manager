import crypto from 'crypto';

// Mã hóa field nhạy cảm (AES-256-GCM, IV ngẫu nhiên mỗi lần).
// Giá trị đã mã hóa có dạng "enc:v1:<iv>:<tag>:<ciphertext>" (base64) nên:
//  - dữ liệu cũ chưa mã hóa vẫn đọc được bình thường (không có tiền tố),
//  - mã hóa lại một giá trị đã mã hóa sẽ được bỏ qua (không mã hóa 2 lần).
// Khóa: FIELD_ENCRYPTION_KEY = 32 byte dạng hex (64 ký tự) hoặc base64.
// MẤT KHÓA = MẤT DỮ LIỆU đã mã hóa -> phải sao lưu khóa an toàn.
const ALGO = 'aes-256-gcm';
const PREFIX = 'enc:v1:';

let cachedKey;
let warnedMissingKey = false;

function parseKey(raw) {
  if (!raw) return null;
  const value = raw.trim();
  const buf = /^[0-9a-fA-F]{64}$/.test(value) ? Buffer.from(value, 'hex') : Buffer.from(value, 'base64');
  if (buf.length !== 32) {
    throw new Error('FIELD_ENCRYPTION_KEY phải là 32 byte (64 ký tự hex hoặc base64 của 32 byte)');
  }
  return buf;
}

export function getFieldKey() {
  if (cachedKey === undefined) cachedKey = parseKey(process.env.FIELD_ENCRYPTION_KEY);
  return cachedKey;
}

// Chỉ dùng trong test / script khi đổi biến môi trường lúc đang chạy
export function resetFieldKeyCache() {
  cachedKey = undefined;
}

export const isEncrypted = (value) => typeof value === 'string' && value.startsWith(PREFIX);

export function encryptString(value) {
  if (value === null || value === undefined || value === '' || isEncrypted(value)) return value;
  const key = getFieldKey();
  if (!key) {
    if (!warnedMissingKey) {
      warnedMissingKey = true;
      console.warn('⚠️  Chưa cấu hình FIELD_ENCRYPTION_KEY: dữ liệu nhạy cảm đang được lưu KHÔNG mã hóa.');
    }
    return value;
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv, { authTagLength: 16 });
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

// Giải mã thất bại (sai/thiếu khóa) -> trả nguyên giá trị đã mã hóa thay vì null,
// để client gửi lại nguyên văn khi cập nhật thì dữ liệu không bị ghi đè mất.
export function decryptString(value) {
  if (!isEncrypted(value)) return value;
  const key = getFieldKey();
  if (!key) return value;
  try {
    const [ivB64, tagB64, dataB64] = value.slice(PREFIX.length).split(':');
    const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(ivB64, 'base64'), { authTagLength: 16 });
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
  } catch (err) {
    console.error('❌ Không giải mã được field (sai FIELD_ENCRYPTION_KEY?):', err.message);
    return value;
  }
}
