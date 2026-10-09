import mongoose from 'mongoose';
const { Schema } = mongoose;

const userSchema = new Schema({
  username: { type: String, required: true, unique: true },
  password_hash: { type: String, required: true },
  role: { type: String, enum: ['Admin', 'Doctor', 'Nurse', 'Receptionist', 'Accountant', 'Pharmacist', 'Patient'], default: 'Receptionist' },
  employee_id: { type: Schema.Types.ObjectId, ref: 'Employee' },
  patient_id: { type: Schema.Types.ObjectId, ref: 'Patient' },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
  disabled: { type: Boolean, default: false },
  // Quên mật khẩu: chỉ lưu hash của token, token gốc nằm trong link gửi qua email
  reset_token_hash: { type: String, select: false },
  reset_token_expires: { type: Date, select: false },
});

export default mongoose.models.User || mongoose.model('User', userSchema);