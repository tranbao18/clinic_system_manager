import express from 'express';
const router = express.Router();

import ctrl from '../controllers/medicine.controller.js';
import auth from '../../middleware/auth.middleware.js';
import validate from '../utils/validate.js';
import validator from '../validators/medicine.validator.js';
import spreadsheetUpload from '../utils/spreadsheet-upload.js';

// Upload Excel/CSV vào memory, giới hạn dung lượng + định dạng (utils/spreadsheet-upload.js)
const upload = spreadsheetUpload('file');

router.post('/', auth(["Admin", "Accountant", "Pharmacist"]), validator.createMedicine(), validate, ctrl.create);
router.post('/import', auth(["Admin", "Accountant", "Pharmacist"]), upload, ctrl.import);

router.get('/', auth(["Admin", "Accountant", "Pharmacist", "Doctor"]), ctrl.findAll);
router.get('/:id', auth(["Admin", "Accountant", "Pharmacist", "Doctor"]), ctrl.findById);

router.put('/:id', auth(["Admin", "Accountant", "Pharmacist"]), validator.updateMedicine(), validate, ctrl.update);
router.delete('/:id', auth("Admin"), ctrl.remove);
router.put('/:id/restore', auth("Admin"), ctrl.restore);
router.post('/bulk-delete', auth("Admin"), ctrl.bulkDelete);

export default router;