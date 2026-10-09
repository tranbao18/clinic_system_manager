// Gộp các thuốc bị tạo trùng (lỗi import cũ: tên có ký tự đặc biệt như "Vitamin C (500mg)" không khớp chính nó).
// Thuốc trùng = cùng tên và cùng đơn vị (không phân biệt hoa thường, khoảng trắng thừa).
// Giữ bản cũ nhất (ưu tiên bản chưa xóa), chuyển mọi tham chiếu (lô nhập, toa thuốc, hóa đơn) sang bản giữ lại,
// gộp danh mục, rồi xóa các bản trùng. Cùng tên nhưng khác đơn vị chỉ được liệt kê, KHÔNG gộp.
// Chạy từ thư mục backend:
//   node scripts/merge-duplicate-medicines.js           -> chạy thử, in danh sách sẽ gộp
//   node scripts/merge-duplicate-medicines.js --apply   -> gộp thật (nên sao lưu DB trước)
import 'dotenv/config';
import '../src/config/timezone.js';
import mongoose from 'mongoose';
import { pathToFileURL } from 'url';

export const normalizeText = (s) => String(s ?? '').normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();

const createdAt = (m) => new Date(m.created_at || m._id.getTimestamp()).getTime();

export async function planMedicineMerge(db) {
  const medicines = await db.collection('medicines').find({}).toArray();
  const groups = new Map();
  const byName = new Map();
  for (const m of medicines) {
    const key = `${normalizeText(m.name)}|${normalizeText(m.unit)}`;
    groups.set(key, [...(groups.get(key) || []), m]);
    const nameKey = normalizeText(m.name);
    byName.set(nameKey, new Set([...(byName.get(nameKey) || []), normalizeText(m.unit)]));
  }

  const merges = [];
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    list.sort((a, b) => (Number(!!a.disabled) - Number(!!b.disabled)) || (createdAt(a) - createdAt(b)));
    const [keep, ...duplicates] = list;
    const prices = [...new Set(list.map((m) => m.price).filter((p) => p !== undefined && p !== null))];
    merges.push({ keep, duplicates, priceConflict: prices.length > 1 ? prices : null });
  }
  const unitConflicts = [...byName.entries()].filter(([, units]) => units.size > 1).map(([name, units]) => ({ name, units: [...units] }));
  return { merges, unitConflicts };
}

export async function applyMedicineMerge(db, plan) {
  const counts = { imports: 0, records: 0, invoices: 0, deleted: 0 };
  for (const { keep, duplicates } of plan.merges) {
    const dupIds = duplicates.map((d) => d._id);

    counts.imports += (await db.collection('medicineimports').updateMany(
      { medicine_id: { $in: dupIds } }, { $set: { medicine_id: keep._id } }
    )).modifiedCount;
    counts.records += (await db.collection('medicalrecords').updateMany(
      { 'prescriptions.medicine_id': { $in: dupIds } },
      { $set: { 'prescriptions.$[p].medicine_id': keep._id } },
      { arrayFilters: [{ 'p.medicine_id': { $in: dupIds } }] }
    )).modifiedCount;
    counts.invoices += (await db.collection('invoices').updateMany(
      { 'stock_deductions.medicine_id': { $in: dupIds } },
      { $set: { 'stock_deductions.$[d].medicine_id': keep._id } },
      { arrayFilters: [{ 'd.medicine_id': { $in: dupIds } }] }
    )).modifiedCount;

    const categories = [...new Set([keep, ...duplicates].flatMap((m) => (Array.isArray(m.category) ? m.category : [])))];
    const price = keep.price ?? duplicates.find((d) => d.price !== undefined && d.price !== null)?.price;
    await db.collection('medicines').updateOne(
      { _id: keep._id },
      { $set: { category: categories, ...(price !== undefined ? { price } : {}), updated_at: new Date() } }
    );
    counts.deleted += (await db.collection('medicines').deleteMany({ _id: { $in: dupIds } })).deletedCount;
  }
  return counts;
}

async function main() {
  const apply = process.argv.includes('--apply');
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI chưa được cấu hình trong .env');
    process.exitCode = 1;
    return;
  }

  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME, autoIndex: false });
  try {
    const db = mongoose.connection.db;
    console.log(`Đã kết nối DB: ${mongoose.connection.name}`);
    const plan = await planMedicineMerge(db);
    console.log(`Nhóm thuốc trùng: ${plan.merges.length}`);
    for (const { keep, duplicates, priceConflict } of plan.merges) {
      console.log(`  "${keep.name}" (${keep.unit || 'không đơn vị'}): giữ ${keep._id}, gộp ${duplicates.length} bản: ${duplicates.map((d) => d._id).join(', ')}` +
        (priceConflict ? ` — GIÁ KHÁC NHAU ${priceConflict.join(' / ')}, giữ giá ${keep.price}` : ''));
    }
    for (const c of plan.unitConflicts) {
      console.log(`  Cùng tên khác đơn vị (không gộp, kiểm tra tay): "${c.name}" — ${c.units.join(', ')}`);
    }
    if (!apply) {
      console.log('Chạy thử xong. Thêm --apply để gộp.');
      return;
    }
    const counts = await applyMedicineMerge(db, plan);
    console.log(`Đã chuyển ${counts.imports} lô nhập, ${counts.records} bệnh án, ${counts.invoices} hóa đơn; xóa ${counts.deleted} thuốc trùng.`);
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
