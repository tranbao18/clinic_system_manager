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
      const user = payload.sub ? await User.findById(payload.sub).select('role disabled').lean() : null;
      if (!user || user.disabled) {
        return res.status(401).json({ message: 'Tài khoản không còn hiệu lực' });
      }

      req.user = { ...payload, role: user.role };
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
