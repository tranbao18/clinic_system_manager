import bcrypt from "bcryptjs";

import dao from '../dao/user.dao.js';
import UserService from '../services/user.service.js';
import pickFields from '../utils/pick-fields.js';

// Không bao giờ trả password_hash về client
const stripHash = (doc) => {
  if (!doc) return doc;
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  delete obj.password_hash;
  return obj;
};

class UserController {
  async create(req, res) {
    try {
      let data = req.body;
      const hashedPassword = await bcrypt.hash(data.password, 10);

      const result = await dao.create({
        username: data.username,
        password_hash: hashedPassword,
        role: data.role,
        employee_id: data.employee_id,
      });
      res.status(201).json(stripHash(result));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };

  async findAll(req, res) {
    try {
      const result = await dao.model.find({ disabled: false }).select('-password_hash');
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };

  async findById(req, res) {
    try {
      const result = await dao.findById(req.params.id);
      if (!result) return res.status(404).json({ message: 'Not found' });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };

  async update(req, res) {
    try {
      // Không cho sửa password_hash/disabled qua API này (đổi mật khẩu dùng /changepass, xóa/khôi phục dùng route riêng)
      const result = await dao.update(req.params.id, pickFields(req.body, ['username', 'role', 'employee_id']));
      if (!result) return res.status(404).json({ message: 'Not found' });
      res.json(stripHash(result));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };

  async remove(req, res) {
    try {
      await UserService.deleteCascade(req.params.id);
      res.json({ message: 'Deleted with cascade' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };

  async restore(req, res) {
    try {
      await UserService.restoreCascade(req.params.id);
      res.json({ message: 'Restored with cascade' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };

  async changepass(req, res) {
    try {
      // Nhân viên chỉ được đổi mật khẩu của chính mình; Admin đổi được cho mọi người
      if (req.user.role !== 'Admin' && String(req.user.sub) !== String(req.params.id)) {
        return res.status(403).json({ error: 'Không có quyền đổi mật khẩu tài khoản này' });
      }
      const { oldPassword, newPassword } = req.body || {};
      if (typeof oldPassword !== 'string' || typeof newPassword !== 'string' || newPassword.length < 6) {
        return res.status(400).json({ error: 'Mật khẩu mới phải có ít nhất 6 ký tự' });
      }
      const result = await dao.changePassword(req.params.id, oldPassword, newPassword);
      res.json(result);
    } catch (err) {
      // Sai mật khẩu cũ / user không tồn tại là lỗi phía client
      const clientError = /Mật khẩu cũ không đúng|User không tồn tại/.test(err.message);
      res.status(clientError ? 400 : 500).json({ error: err.message });
    }
  };
}

export default new UserController();