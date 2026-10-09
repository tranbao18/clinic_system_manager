import mongoose from 'mongoose';
const Schema = mongoose.Schema;

const paymentSchema = new Schema({
  invoice_id: { type: Schema.Types.ObjectId, ref: 'Invoice' },
  method: String,
  amount: Number,
  date: Date,
  updated_at: { type: Date, default: Date.now },
  disabled: { type: Boolean, default: false },
  // true khi bị vô hiệu hóa do xóa hóa đơn (để khôi phục hóa đơn không hồi sinh các khoản đã hủy riêng)
  disabled_by_cascade: { type: Boolean, select: false },
});

export default mongoose.model('Payment', paymentSchema);