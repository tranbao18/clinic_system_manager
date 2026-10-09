import MedicineImport from '../models/medicine-import.model.js';

const MAX_ROUNDS = 5;

const insufficientError = (message, shortages) =>
  Object.assign(new Error(message), { status: 400, shortages });

// Gộp toa thuốc theo medicine_id (1 thuốc có thể xuất hiện nhiều dòng)
export function aggregatePrescriptions(prescriptions = []) {
  const byMedicine = new Map();
  for (const p of prescriptions) {
    const medicine = p.medicine_id;
    const id = String(medicine?._id || medicine);
    const current = byMedicine.get(id) || { medicine_id: id, name: medicine?.name, quantity: 0 };
    current.quantity += Number(p.quantity);
    byMedicine.set(id, current);
  }
  return [...byMedicine.values()];
}

// Tồn kho còn hạn sử dụng của 1 thuốc (không tính lô đã hết hạn)
export async function availableQuantity(medicineId) {
  const batches = await MedicineImport.find({
    medicine_id: medicineId,
    disabled: false,
    remaining: { $gt: 0 },
    expiry_date: { $gte: new Date() },
  }).select('remaining');
  return batches.reduce((sum, b) => sum + (b.remaining || 0), 0);
}

// Trả lại kho đúng số lượng đã trừ ở từng lô
export async function releaseDeductions(deductions = []) {
  for (const d of deductions) {
    await MedicineImport.updateOne(
      { _id: d.import_id },
      { $inc: { remaining: d.quantity }, $set: { updated_at: new Date() } }
    );
  }
}

// Trừ kho theo FEFO (lô hết hạn sớm nhất trước), chỉ dùng lô còn hạn.
// Mỗi lô được trừ bằng $inc có điều kiện remaining >= n nên an toàn khi nhiều người thao tác cùng lúc.
// Trả về danh sách [{ import_id, medicine_id, quantity }] để hoàn kho chính xác khi cần.
export async function deductFEFO(medicineId, quantity, medicineName = '') {
  let left = quantity;
  const deductions = [];

  for (let round = 0; left > 0 && round < MAX_ROUNDS; round++) {
    const batches = await MedicineImport.find({
      medicine_id: medicineId,
      disabled: false,
      remaining: { $gt: 0 },
      expiry_date: { $gte: new Date() },
    }).sort({ expiry_date: 1, import_date: 1 });
    if (batches.length === 0) break;

    for (const batch of batches) {
      if (left <= 0) break;
      const take = Math.min(left, batch.remaining);
      const updated = await MedicineImport.findOneAndUpdate(
        { _id: batch._id, disabled: false, remaining: { $gte: take } },
        { $inc: { remaining: -take }, $set: { updated_at: new Date() } },
        { new: true }
      );
      if (!updated) continue; // lô vừa bị trừ bởi thao tác khác -> đọc lại ở vòng sau
      deductions.push({ import_id: batch._id, medicine_id: medicineId, quantity: take });
      left -= take;
    }
  }

  if (left > 0) {
    await releaseDeductions(deductions);
    throw insufficientError(
      `Không đủ thuốc còn hạn trong kho${medicineName ? `: ${medicineName}` : ''} (thiếu ${left})`,
      [{ medicine_id: String(medicineId), name: medicineName, missing: left }]
    );
  }
  return deductions;
}

// Trừ kho cho cả toa thuốc: hoặc trừ đủ tất cả, hoặc không trừ gì (hoàn lại phần đã trừ)
export async function deductForPrescriptions(items) {
  const shortages = [];
  for (const item of items) {
    const available = await availableQuantity(item.medicine_id);
    if (available < item.quantity) {
      shortages.push({ medicine_id: item.medicine_id, name: item.name, required: item.quantity, available });
    }
  }
  if (shortages.length > 0) {
    const list = shortages.map((s) => `${s.name || s.medicine_id} (cần ${s.required}, còn ${s.available})`).join(', ');
    throw insufficientError(`Không đủ thuốc còn hạn trong kho: ${list}`, shortages);
  }

  const all = [];
  try {
    for (const item of items) {
      all.push(...(await deductFEFO(item.medicine_id, item.quantity, item.name)));
    }
  } catch (err) {
    await releaseDeductions(all);
    throw err;
  }
  return all;
}

// Trừ lại đúng các lô đã ghi nhận (khi khôi phục hóa đơn). Trả về false nếu lô không còn đủ.
export async function reapplyDeductions(deductions = []) {
  const done = [];
  for (const d of deductions) {
    const ok = await MedicineImport.findOneAndUpdate(
      { _id: d.import_id, remaining: { $gte: d.quantity } },
      { $inc: { remaining: -d.quantity }, $set: { updated_at: new Date() } }
    );
    if (!ok) {
      await releaseDeductions(done);
      return false;
    }
    done.push(d);
  }
  return true;
}
