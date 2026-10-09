import jwt from 'jsonwebtoken';
import TokenBlacklist from '../src/models/token-blacklist.model.js';
import User from '../src/models/user.model.js';

const authMiddleware = (roles = []) => {
  if (typeof roles === 'string') roles = [roles];
  return async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) return res.status(401).json({ message: 'No token' });

      const parts = authHeader.split(' ');
      if (parts.length !== 2) return res.status(401).json({ message: 'Format token không hợp lệ' });

      const token = parts[1];
      const blacklisted = await TokenBlacklist.findOne({ token });
      if (blacklisted) return res.status(401).json({ message: 'Token đã bị thu hồi' });

      const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });

      // Đọc lại user từ DB: tài khoản bị vô hiệu hóa/xóa sẽ mất quyền ngay,
      // và đổi role có hiệu lực ngay thay vì chờ token hết hạn
      const user = payload.sub ? await User.findById(payload.sub).select('role disabled employee_id patient_id').lean() : null;
      if (!user || user.disabled) {
        return res.status(401).json({ message: 'Tài khoản không còn hiệu lực' });
      }

      // employee_id/patient_id dùng để kiểm tra quyền sở hữu (bác sĩ chỉ sửa hồ sơ của mình, bệnh nhân chỉ xem lịch của mình)
      req.user = {
        ...payload,
        role: user.role,
        employee_id: user.employee_id ? String(user.employee_id) : undefined,
        patient_id: user.patient_id ? String(user.patient_id) : undefined,
      };
      if (roles.length && !roles.includes(user.role)) {
        console.log('❌ Access denied:', {
          userRole: user.role,
          requiredRoles: roles,
          userId: payload.sub
        });
        return res.status(403).json({
          message: 'Không có quyền truy cập',
          userRole: user.role,
          requiredRoles: roles
        });
      }
      next();
    } catch (err) {
      return res.status(401).json({ message: 'Token không hợp lệ' });
    }
  };
};

export default authMiddleware;
