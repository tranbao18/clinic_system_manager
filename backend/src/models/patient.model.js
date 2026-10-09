import mongoose from 'mongoose';
import fieldEncryptPlugin from '../plugins/fieldEncryptPlugin.js';
const Schema = mongoose.Schema;

const historySchema = new Schema({
  khoa: { type: String },
  description: { type: String },
}, { _id: false });
// Mô tả tiền sử bệnh là dữ liệu sức khỏe -> mã hóa khi lưu
historySchema.plugin(fieldEncryptPlugin, { fields: ['description'] });

const patientSchema = new Schema({
  fullname: { type: String, required: true },
  dob: { type: Date },
  gender: { type: String },
  phone: { type: String },
  address: { type: String },
  email: { type: String },
  medical_history: [historySchema],
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
  disabled: { type: Boolean, default: false },
});

// Thông tin liên hệ được mã hóa khi lưu. fullname/dob/gender giữ nguyên để hiển thị, tìm kiếm, sắp xếp.
patientSchema.plugin(fieldEncryptPlugin, { fields: ['phone', 'address', 'email'] });

export default mongoose.models.Patient || mongoose.model('Patient', patientSchema);