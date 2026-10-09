// Mã hóa dữ liệu nhạy cảm ĐÃ CÓ trong DB (dữ liệu mới tự được mã hóa khi lưu).
// Cần FIELD_ENCRYPTION_KEY trong .env (giống hệt khóa backend đang dùng). Chạy từ thư mục backend:
//   node scripts/encrypt-sensitive-data.js                    -> chạy thử: chỉ đếm, không ghi
//   node scripts/encrypt-sensitive-data.js --apply            -> mã hóa thật
//   node scripts/encrypt-sensitive-data.js --decrypt --apply  -> hoàn tác: giải mã về dạng thường
// Nên sao lưu DB trước khi chạy --apply. MẤT KHÓA = MẤT DỮ LIỆU đã mã hóa.
import 'dotenv/config';
import '../src/config/timezone.js';
import mongoose from 'mongoose';
import { pathToFileURL } from 'url';
import { encryptString, decryptString, isEncrypted, getFieldKey } from '../src/utils/crypto-field.js';

// Phải khớp với các field khai báo fieldEncryptPlugin trong models
export const TARGETS = [
  { collection: 'patients', fields: ['phone', 'address', 'email'], arrayFields: { medical_history: ['description'] } },
  { collection: 'medicalrecords', fields: ['diagnosis', 'treatment', 'notes'] },
];

export async function migrateSensitiveData(db, { apply = false, decrypt = false } = {}) {
  const needsWork = (v) => typeof v === 'string' && v !== '' && (decrypt ? isEncrypted(v) : !isEncrypted(v));
  const transform = (v) => {
    const out = decrypt ? decryptString(v) : encryptString(v);
    // decryptString trả nguyên giá trị khi sai khóa -> coi là lỗi, không ghi
    if (out === v) throw new Error(decrypt ? 'Không giải mã được (sai khóa?)' : 'Không mã hóa được (thiếu khóa?)');
    return out;
  };

  const summary = {};
  for (const { collection, fields, arrayFields = {} } of TARGETS) {
    const coll = db.collection(collection);
    const projection = Object.fromEntries([...fields, ...Object.keys(arrayFields)].map((f) => [f, 1]));
    const stats = { scanned: 0, changed: 0, failed: 0 };

    for await (const doc of coll.find({}, { projection })) {
      stats.scanned++;
      try {
        const set = {};
        for (const f of fields) {
          if (needsWork(doc[f])) set[f] = transform(doc[f]);
        }
        for (const [arrayField, subFields] of Object.entries(arrayFields)) {
          if (!Array.isArray(doc[arrayField])) continue;
          let touched = false;
          const next = doc[arrayField].map((item) => {
            if (!item || typeof item !== 'object') return item;
            const copy = { ...item };
            for (const sf of subFields) {
              if (needsWork(copy[sf])) {
                copy[sf] = transform(copy[sf]);
                touched = true;
              }
            }
            return copy;
          });
          if (touched) set[arrayField] = next;
        }
        if (Object.keys(set).length > 0) {
          stats.changed++;
          if (apply) await coll.updateOne({ _id: doc._id }, { $set: set });
        }
      } catch (err) {
        stats.failed++;
        console.error(`  ${collection} ${doc._id}: ${err.message}`);
      }
    }
    summary[collection] = stats;
  }
  return summary;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const decrypt = process.argv.includes('--decrypt');
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI chưa được cấu hình trong .env');
    process.exitCode = 1;
    return;
  }
  if (!getFieldKey()) {
    console.error('FIELD_ENCRYPTION_KEY chưa được cấu hình trong .env');
    process.exitCode = 1;
    return;
  }

  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME, autoIndex: false });
  try {
    console.log(`Đã kết nối DB: ${mongoose.connection.name}`);
    console.log(`Chế độ: ${decrypt ? 'GIẢI MÃ' : 'MÃ HÓA'} — ${apply ? 'GHI THẬT' : 'chạy thử (thêm --apply để ghi)'}`);
    const summary = await migrateSensitiveData(mongoose.connection.db, { apply, decrypt });
    for (const [collection, s] of Object.entries(summary)) {
      console.log(`  ${collection}: quét ${s.scanned}, ${apply ? 'đã cập nhật' : 'sẽ cập nhật'} ${s.changed}, lỗi ${s.failed}`);
    }
  } finally {
    await mongoose.disconnect();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
