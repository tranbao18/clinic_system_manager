import multer from 'multer';

// Giữ 10MB cho khớp hướng dẫn trên giao diện ("Kích thước tối đa: 10MB")
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const ALLOWED_MIMES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls
  'text/csv' // .csv
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIMES.includes(file.mimetype) || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      const err = new Error('Định dạng file không được hỗ trợ. Chỉ chấp nhận file Excel (.xlsx, .xls) hoặc CSV (.csv)');
      err.status = 400;
      cb(err);
    }
  }
});

// Bọc multer để lỗi upload trả 400/413 kèm thông báo rõ ràng thay vì rơi vào handler 500 chung
export default function spreadsheetUpload(field = 'file') {
  const handler = upload.single(field);
  return (req, res, next) => {
    handler(req, res, (err) => {
      if (!err) return next();
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({ error: `File vượt quá dung lượng cho phép (tối đa ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB)` });
        }
        return res.status(400).json({ error: `Lỗi upload file: ${err.message}` });
      }
      if (err.status === 400) return res.status(400).json({ error: err.message });
      return next(err);
    });
  };
}
