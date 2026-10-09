import mongoose from 'mongoose';
const Schema = mongoose.Schema;

const invoiceSchema = new Schema({
  patient_id: { type: Schema.Types.ObjectId, ref: 'Patient' },
  appointment_id: { type: Schema.Types.ObjectId, ref: 'Appointment' },
  total_amount: Number,
  status: { type: String, enum: ['Unpaid','Paid','Partial'], default: 'Unpaid' },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
  disabled: { type: Boolean, default: false },
  // Các lô thuốc đã trừ khi tạo hóa đơn -> dùng để hoàn kho chính xác khi xóa hóa đơn
  stock_deductions: {
    type: [{
      _id: false,
      import_id: { type: Schema.Types.ObjectId, ref: 'MedicineImport' },
      medicine_id: { type: Schema.Types.ObjectId, ref: 'Medicine' },
      quantity: Number,
    }],
    select: false,
  },
  stock_restored: { type: Boolean, default: false },
  locked_until: { type: Date, select: false },
});

export default mongoose.model('Invoice', invoiceSchema);