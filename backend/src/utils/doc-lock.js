// Khóa ngắn hạn trên 1 document (field locked_until) để tuần tự hóa các thao tác "kiểm tra rồi ghi"
// (vd: 2 lần bấm "Tạo hóa đơn" cùng lúc, 2 khoản thanh toán cùng lúc).
// Không dùng transaction vì cluster Atlas M0 đang dùng. Model phải khai báo field locked_until trong schema.
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default async function withDocLock(Model, id, fn, { ttlMs = 30000, retries = 20, delayMs = 150 } = {}) {
  let locked = null;
  for (let i = 0; i < retries && !locked; i++) {
    const now = new Date();
    locked = await Model.findOneAndUpdate(
      { _id: id, $or: [{ locked_until: null }, { locked_until: { $lt: now } }] },
      { $set: { locked_until: new Date(now.getTime() + ttlMs) } },
      { new: true }
    );
    if (!locked) {
      if (!(await Model.exists({ _id: id }))) {
        throw Object.assign(new Error('Không tìm thấy dữ liệu'), { status: 404 });
      }
      await sleep(delayMs);
    }
  }
  if (!locked) {
    throw Object.assign(new Error('Dữ liệu đang được xử lý bởi thao tác khác, vui lòng thử lại'), { status: 409 });
  }

  try {
    return await fn(locked);
  } finally {
    await Model.updateOne({ _id: id }, { $unset: { locked_until: 1 } });
  }
}
