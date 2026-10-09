import express from 'express';
const router = express.Router();

import ctrl from '../controllers/payroll.controller.js';
import auth from '../../middleware/auth.middleware.js';
import validate from '../utils/validate.js';
import validator from '../validators/payroll.validator.js';
import spreadsheetUpload from '../utils/spreadsheet-upload.js';

// Upload Excel/CSV vào memory, giới hạn dung lượng + định dạng (utils/spreadsheet-upload.js)
const upload = spreadsheetUpload('file');

router.post("/send/bulk", auth(["Admin", "Accountant"]), ctrl.sendPayrollBulk);
router.post("/send/:employee_id", auth(["Admin", "Accountant"]), ctrl.sendPayrollToEmployee);
router.post("/send/payroll/bulk", auth(["Admin", "Accountant"]), ctrl.sendPayrollBulkById);
router.post("/send/payroll/:payroll_id", auth(["Admin", "Accountant"]), ctrl.sendPayrollById);

router.post('/import', auth(["Admin", "Accountant"]), upload, ctrl.import);
router.post('/', auth(["Admin", "Accountant"]), validator.createPayroll(), validate, ctrl.create);

router.get('/', auth(["Admin", "Accountant"]), ctrl.findAll);
router.get('/:id', auth(["Admin", "Accountant"]), ctrl.findById);

router.put('/:id', auth(["Admin", "Accountant"]), validator.updatePayroll(), validate, ctrl.update);
router.delete('/:id', auth(["Admin", "Accountant"]), ctrl.remove);
router.put('/:id/restore', auth("Admin"), ctrl.restore);

export default router;