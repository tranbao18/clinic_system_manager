// Hàm parse dữ liệu đọc từ file import (Excel/CSV). Thuần JS, không truy cập DB.

// Số dòng dữ liệu tối đa xử lý trong một file import
export const MAX_IMPORT_ROWS = 2000;

export function isBlankCell(value) {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}

export function escapeRegex(str = '') {
  return String(str ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Khớp nguyên chuỗi (đã trim), không phân biệt hoa thường; chấp nhận khoảng trắng thừa trong DB
export function exactMatchRegex(str = '') {
  return new RegExp(`^\\s*${escapeRegex(String(str ?? '').trim())}\\s*$`, 'i');
}

// Chuẩn hóa tên cột: bỏ dấu, "đ" → "d" (NFD không tách được "đ"), bỏ ký tự đặc biệt
export function normalizeHeaderKey(key = '') {
  return String(key ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]/g, '');
}

function parseNumericBody(body) {
  if (!/\d/.test(body)) return NaN;

  const lastDot = body.lastIndexOf('.');
  const lastComma = body.lastIndexOf(',');
  let intPart = body;
  let fracPart = '';
  let thousandsSep = null;

  if (lastDot !== -1 && lastComma !== -1) {
    // Có cả "." và "," → dấu xuất hiện sau cùng là dấu thập phân
    const decSep = lastDot > lastComma ? '.' : ',';
    thousandsSep = decSep === '.' ? ',' : '.';
    const idx = body.lastIndexOf(decSep);
    intPart = body.slice(0, idx);
    fracPart = body.slice(idx + 1);
    if (intPart.includes(decSep)) return NaN;
  } else if (lastDot !== -1 || lastComma !== -1) {
    const sep = lastDot !== -1 ? '.' : ',';
    const parts = body.split(sep);
    if (parts.length > 2) {
      thousandsSep = sep;
    } else if (/^[1-9]\d{0,2}$/.test(parts[0]) && /^\d{3}$/.test(parts[1])) {
      // Một dấu, theo sau đúng 3 chữ số → phân cách hàng nghìn ("42.000", "1,500")
      thousandsSep = sep;
    } else {
      [intPart, fracPart] = parts;
    }
  }

  if (thousandsSep) {
    const grouping = thousandsSep === '.' ? /^\d{1,3}(\.\d{3})*$/ : /^\d{1,3}(,\d{3})*$/;
    if (!grouping.test(intPart)) return NaN;
    intPart = intPart.split(thousandsSep).join('');
  }

  if (!/^\d*$/.test(intPart) || !/^\d*$/.test(fracPart)) return NaN;
  if (intPart === '' && fracPart === '') return NaN;

  const n = Number(`${intPart || '0'}.${fracPart || '0'}`);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Parse số kiểu Việt Nam ("10.000.000", "1.250.000,5") lẫn kiểu Anh ("10,000,000", "1,250,000.5").
 * Trả về: Number hữu hạn; null nếu ô trống; NaN nếu không parse được.
 * Giữ nguyên dấu âm để nơi gọi tự từ chối.
 */
export function parseVNNumber(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  if (typeof value !== 'string') return NaN;

  const s = value
    .normalize('NFC')
    .replace(/\s+/g, '')
    .toLowerCase()
    .replace(/−/g, '-');
  if (s === '') return null;

  const m = s.match(/^([+-]?)(?:vnđ|vnd|₫|đ)?([+-]?)([\d.,]+)(?:vnđ|vnd|đồng|dong|₫|đ)?$/);
  if (!m || (m[1] && m[2])) return NaN;

  const n = parseNumericBody(m[3]);
  if (Number.isNaN(n)) return NaN;
  return (m[1] || m[2]) === '-' ? -n : n;
}

// Tạo Date giờ địa phương, trả null nếu ngày/tháng/giờ không tồn tại (vd 31/02)
function buildLocalDate(y, mo, d, h = 0, mi = 0, s = 0) {
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 59) return null;
  const date = new Date(y, mo - 1, d, h, mi, s);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  return date;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30);
const EXCEL_MAX_SERIAL = 2958465; // 31/12/9999

function fromExcelSerial(serial) {
  if (!Number.isFinite(serial) || serial < 1 || serial >= EXCEL_MAX_SERIAL + 1) return null;
  let days = Math.floor(serial);
  let secs = Math.round((serial - days) * 86400);
  // Sai lệch < 1 phút quanh 0h (do timezone khi ghi file) → coi như đúng nửa đêm
  if (secs < 60) secs = 0;
  else if (secs > 86400 - 60) { days += 1; secs = 0; }

  const utc = new Date(EXCEL_EPOCH_UTC + days * MS_PER_DAY);
  return buildLocalDate(
    utc.getUTCFullYear(), utc.getUTCMonth() + 1, utc.getUTCDate(),
    Math.floor(secs / 3600), Math.floor((secs % 3600) / 60), secs % 60
  );
}

/**
 * Parse ngày từ ô Excel/CSV: Date, số serial Excel, "dd/mm/yyyy" (cả "-" và "."),
 * "yyyy-mm-dd", ISO datetime. Ngày không kèm giờ → 0h giờ địa phương.
 * Trả về Date hoặc null (trống hoặc không hợp lệ — nơi gọi quyết định có báo lỗi hay không).
 */
export function parseFlexibleDate(value) {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
  if (typeof value === 'number') return fromExcelSerial(value);
  if (typeof value !== 'string') return null;

  const str = value.trim();
  if (str === '') return null;

  if (/^\d+(\.\d+)?$/.test(str)) return fromExcelSerial(Number(str));

  const time = '(?:[ T](\\d{1,2}):(\\d{2})(?::(\\d{2}))?)?';

  // Ngày trước (kiểu Việt Nam): dd/mm/yyyy, dd-mm-yyyy, dd.mm.yyyy
  let m = str.match(new RegExp(`^(\\d{1,2})([/.-])(\\d{1,2})\\2(\\d{4})${time}$`));
  if (m) {
    return buildLocalDate(+m[4], +m[3], +m[1], +(m[5] || 0), +(m[6] || 0), +(m[7] || 0));
  }

  // ISO datetime có múi giờ (Z hoặc +07:00) → để Date tự xử lý, nhưng vẫn kiểm tra ngày hợp lệ
  m = str.match(/^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/i);
  if (m) {
    if (!buildLocalDate(+m[1], +m[2], +m[3])) return null;
    const d = new Date(str);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // Năm trước: yyyy-mm-dd, yyyy/mm/dd (có thể kèm giờ, hiểu theo giờ địa phương)
  m = str.match(new RegExp(`^(\\d{4})([/.-])(\\d{1,2})\\2(\\d{1,2})${time}(?:\\.\\d+)?$`));
  if (m) {
    return buildLocalDate(+m[1], +m[3], +m[4], +(m[5] || 0), +(m[6] || 0), +(m[7] || 0));
  }

  return null;
}
