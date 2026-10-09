import { body, param } from 'express-validator';

// Số lượng âm/lẻ sẽ làm sai tổng tiền hóa đơn và tồn kho
const prescriptionItemRules = () => [
  body('prescriptions.*.medicine_id').isMongoId().withMessage('Thuốc trong toa không hợp lệ'),
  body('prescriptions.*.quantity').isInt({ min: 1 }).withMessage('Số lượng thuốc phải là số nguyên dương').toInt(),
  body('prescriptions.*.dosage').optional({ nullable: true }).isString()
];

export default class MedicalRecordValidator {
  static createMedicalRecord() {
    return [
      body('appointment_id')
        .optional({ checkFalsy: true, nullable: true })
        .custom((value) => {
          if (value === undefined || value === null || value === '') {
            return true; // Bỏ qua validation nếu không có giá trị
          }
          // Chỉ validate nếu có giá trị
          return /^[0-9a-fA-F]{24}$/.test(value);
        })
        .withMessage('appointment_id phải là MongoDB ObjectId hợp lệ'),
      body('patient_id').isMongoId().withMessage('patient_id phải là MongoDB ObjectId hợp lệ'),
      // Có thể bỏ trống: controller lấy từ tài khoản bác sĩ hoặc từ lịch hẹn, và kiểm tra lại trước khi lưu
      body('doctor_id').optional({ checkFalsy: true }).isMongoId().withMessage('doctor_id phải là MongoDB ObjectId hợp lệ'),
      body('diagnosis').isString().notEmpty().withMessage('Chẩn đoán không được để trống'),
      body('treatment').optional().isString(),
      body('notes').optional().isString(),
      body('prescriptions').optional().isArray(),
      ...prescriptionItemRules()
    ];
  }

  static updateMedicalRecord() {
    return [
      param('id').isMongoId(),
      body('diagnosis').optional().isString(),
      body('treatment').optional().isString(),
      body('prescriptions').optional().isArray(),
      ...prescriptionItemRules()
    ];
  }
}