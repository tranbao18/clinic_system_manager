import mongoose from 'mongoose';
import fieldEncryptPlugin from '../plugins/fieldEncryptPlugin.js';
const Schema = mongoose.Schema;

const prescriptionSchema = new Schema({
  medicine_id: { type: Schema.Types.ObjectId, ref: 'Medicine' },
  quantity: Number,
  dosage: String
}, { _id: false });

const medicalRecordSchema = new Schema({
  appointment_id: { type: Schema.Types.ObjectId, ref: 'Appointment' },
  patient_id: { type: Schema.Types.ObjectId, ref: 'Patient' },
  doctor_id: { type: Schema.Types.ObjectId, ref: 'Employee' },
  diagnosis: String,
  treatment: String,
  prescriptions: [prescriptionSchema],
  notes: String,
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
  disabled: { type: Boolean, default: false },
});

// Nội dung khám bệnh là dữ liệu sức khỏe -> mã hóa khi lưu
medicalRecordSchema.plugin(fieldEncryptPlugin, { fields: ['diagnosis', 'treatment', 'notes'] });

export default mongoose.model('MedicalRecord', medicalRecordSchema);