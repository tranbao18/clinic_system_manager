import mongoose from 'mongoose';
const { Schema } = mongoose;

// Email bỏ trống ("", "   ", null) -> undefined (không lưu field). Index unique+sparse chỉ bỏ qua
// document KHÔNG có field email; "" hay null vẫn bị đánh index -> nhân viên thứ 2 không email bị E11000.
export const normalizeEmail = (value) => {
  if (value === null) return undefined;
  if (typeof value !== 'string') return value;
  return value.trim() || undefined;
};

const employeeSchema = new Schema({
  fullname: { type: String, required: true },
  dob: { type: Date },
  gender: { type: String },
  phone: { type: String },
  address: { type: String },
  email: { type: String, unique: true, sparse: true, trim: true, set: normalizeEmail },
  position: { type: String },
  specialization: { type: String },
  basic_salary: Number,
  shift_schedule: { type: Schema.Types.Mixed }, // keep as mixed
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
  disabled: { type: Boolean, default: false },
}, {
  toJSON: {
    transform: (doc, ret) => {
      // Lấy ngày theo giờ Việt Nam (process TZ); toISOString() là ngày UTC nên lệch 1 ngày với 0h-7h giờ VN
      const pad = (n) => String(n).padStart(2, '0');
      const formatDate = (d) => d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : null;
      ret.dob = formatDate(ret.dob);
      // ret.created_at = formatDate(ret.created_at);
      // ret.updated_at = formatDate(ret.updated_at);
      return ret;
    }
  }
});

// Lệnh update với email bỏ trống -> $unset email (setter trả undefined thì Mongoose bỏ qua, email cũ vẫn còn)
employeeSchema.pre(['findOneAndUpdate', 'updateOne', 'updateMany'], function () {
  const update = this.getUpdate();
  if (!update) return;
  for (const target of [update, update.$set]) {
    if (target && target.email !== undefined && normalizeEmail(target.email) === undefined) {
      delete target.email;
      update.$unset = { ...(update.$unset || {}), email: 1 };
    }
  }
});

export default mongoose.models.Employee || mongoose.model('Employee', employeeSchema);