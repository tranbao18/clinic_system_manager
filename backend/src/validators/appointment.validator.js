import { body, param } from 'express-validator';

export default class AppointmentValidator {
  static createAppointment() {
    return [
      body('patient_id').isMongoId(),
      body('doctor_id').isMongoId(),
      body('appointment_date').isISO8601().toDate(),
      body('status').optional().isIn(['Scheduled', 'Completed', 'Cancelled']),
      body('reason').optional().isString()
    ];
  }

  static updateAppointment() {
    return [
      param('id').isMongoId(),
      body('doctor_id').optional().isMongoId().withMessage('Bác sĩ không hợp lệ'),
      body('appointment_date').optional().isISO8601().withMessage('Ngày giờ hẹn không hợp lệ').toDate(),
      body('status').optional().isIn(['Scheduled', 'Completed', 'Cancelled']),
      body('reason').optional().isString()
    ];
  }
}
