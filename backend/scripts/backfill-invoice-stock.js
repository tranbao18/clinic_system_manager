// Bổ sung thông tin "đã trừ kho ở lô nào" (stock_deductions) cho hóa đơn tạo TRƯỚC khi có tính năng hoàn kho.
// Nhờ đó xóa các hóa đơn cũ này cũng hoàn kho được như hóa đơn mới.
// Code cũ không lưu lô đã trừ, nên script suy ra theo đúng cách code cũ trừ kho:
// toa thuốc của bệnh án gắn với lịch hẹn, phân bổ vào các lô theo hạn dùng sớm nhất trước (FEFO),
// không vượt quá lượng thực tế đã xuất của từng lô (quantity - remaining). Hóa đơn cũ hơn được phân bổ trước.
// Chạy từ thư mục backend:
//   node scripts/backfill-invoice-stock.js                     -> chạy thử, in kế hoạch
//   node scripts/backfill-invoice-stock.js --apply             -> ghi stock_deductions vào hóa đơn
//   node scripts/backfill-invoice-stock.js --apply --release-deleted
//        -> đồng thời hoàn kho ngay cho các hóa đơn cũ ĐÃ bị xóa trước đây (trước đây xóa không hoàn kho)
import 'dotenv/config';
import '../src/config/timezone.js';
import mongoose from 'mongoose';
import { pathToFileURL } from 'url';

const idStr = (v) => String(v?._id ?? v);

export async function planInvoiceStockBackfill(db) {
  const invoices = db.collection('invoices');
  const imports = db.collection('medicineimports');
  const records = db.collection('medicalrecords');

  // Lượng đã xuất của từng lô
  const consumed = new Map();
  const batchesByMedicine = new Map();
  for await (const b of imports.find({})) {
    const used = Math.max(0, (Number(b.quantity) || 0) - (Number(b.remaining) || 0));
    consumed.set(idStr(b._id), used);
    const list = batchesByMedicine.get(idStr(b.medicine_id)) || [];
    list.push(b);
    batchesByMedicine.set(idStr(b.medicine_id), list);
  }
  for (const list of batchesByMedicine.values()) {
    list.sort((a, b) => (new Date(a.expiry_date || 0) - new Date(b.expiry_date || 0)) || (new Date(a.import_date || 0) - new Date(b.import_date || 0)));
  }

  // Phần đã được hóa đơn mới (có stock_deductions, chưa hoàn kho) ghi nhận thì không phân bổ lại
  for await (const inv of invoices.find({ 'stock_deductions.0': { $exists: true }, stock_restored: { $ne: true } })) {
    for (const d of inv.stock_deductions) {
      const key = idStr(d.import_id);
      consumed.set(key, Math.max(0, (consumed.get(key) || 0) - (Number(d.quantity) || 0)));
    }
  }

  const plan = [];
  const legacy = await invoices.find({ stock_deductions: { $exists: false } }).sort({ created_at: 1, _id: 1 }).toArray();
  for (const inv of legacy) {
    const entry = { invoice_id: inv._id, disabled: !!inv.disabled, deductions: [], shortfalls: [], note: '' };
    plan.push(entry);

    if (!inv.appointment_id) {
      entry.note = 'không có lịch hẹn -> không trừ kho';
      continue;
    }
    const recs = await records.find({ appointment_id: inv.appointment_id }).sort({ disabled: 1, created_at: -1 }).toArray();
    const record = recs.find((r) => Array.isArray(r.prescriptions) && r.prescriptions.length > 0);
    if (!record) {
      entry.note = 'không có bệnh án/toa thuốc -> không trừ kho';
      continue;
    }

    const needByMedicine = new Map();
    for (const p of record.prescriptions) {
      const qty = Number(p.quantity);
      if (!p.medicine_id || !Number.isInteger(qty) || qty <= 0) continue;
      const key = idStr(p.medicine_id);
      needByMedicine.set(key, (needByMedicine.get(key) || 0) + qty);
    }

    for (const [medicineId, need] of needByMedicine) {
      let left = need;
      for (const batch of batchesByMedicine.get(medicineId) || []) {
        if (left <= 0) break;
        const key = idStr(batch._id);
        const take = Math.min(left, consumed.get(key) || 0);
        if (take <= 0) continue;
        consumed.set(key, consumed.get(key) - take);
        entry.deductions.push({ import_id: batch._id, medicine_id: batch.medicine_id, quantity: take });
        left -= take;
      }
      if (left > 0) entry.shortfalls.push({ medicine_id: medicineId, missing: left });
    }
  }
  return plan;
}

export async function applyInvoiceStockBackfill(db, plan, { releaseDeleted = false } = {}) {
  const invoices = db.collection('invoices');
  const imports = db.collection('medicineimports');
  let written = 0;
  let released = 0;

  for (const entry of plan) {
    // Chỉ ghi nếu hóa đơn vẫn chưa có stock_deductions (chạy lại script không bị ghi 2 lần)
    const release = releaseDeleted && entry.disabled && entry.deductions.length > 0;
    const res = await invoices.updateOne(
      { _id: entry.invoice_id, stock_deductions: { $exists: false } },
      { $set: { stock_deductions: entry.deductions, stock_restored: release } }
    );
    if (res.modifiedCount !== 1) continue;
    written++;
    if (release) {
      for (const d of entry.deductions) {
        await imports.updateOne({ _id: d.import_id }, { $inc: { remaining: d.quantity }, $set: { updated_at: new Date() } });
      }
      released++;
    }
  }
  return { written, released };
}

async function main() {
  const apply = process.argv.includes('--apply');
  const releaseDeleted = process.argv.includes('--release-deleted');
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI chưa được cấu hình trong .env');
    process.exitCode = 1;
    return;
  }

  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME, autoIndex: false });
  try {
    const db = mongoose.connection.db;
    console.log(`Đã kết nối DB: ${mongoose.connection.name}`);
    const plan = await planInvoiceStockBackfill(db);
    console.log(`Hóa đơn cũ cần bổ sung: ${plan.length}`);
    for (const e of plan) {
      const total = e.deductions.reduce((s, d) => s + d.quantity, 0);
      const missing = e.shortfalls.reduce((s, x) => s + x.missing, 0);
      console.log(`  ${e.invoice_id}${e.disabled ? ' (đã xóa)' : ''}: ${total} đơn vị / ${e.deductions.length} lô` +
        (missing ? `, không xác định được ${missing} đơn vị (có thể trước đây thiếu kho)` : '') +
        (e.note ? ` — ${e.note}` : ''));
    }
    if (!apply) {
      console.log('Chạy thử xong. Thêm --apply để ghi (và --release-deleted để hoàn kho cho hóa đơn cũ đã xóa).');
      return;
    }
    const result = await applyInvoiceStockBackfill(db, plan, { releaseDeleted });
    console.log(`Đã cập nhật ${result.written} hóa đơn, hoàn kho cho ${result.released} hóa đơn đã xóa.`);
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
