import bcrypt from "bcryptjs";

import UserDAO from '../dao/user.dao.js';
import EmployeeDAO from '../dao/employee.dao.js';
import PatientDAO from '../dao/patient.dao.js';

import pickFields from '../utils/pick-fields.js';

const STAFF_ROLES = ['Admin', 'Doctor', 'Nurse', 'Receptionist', 'Accountant', 'Pharmacist'];
const EMPLOYEE_FIELDS = ['fullname', 'dob', 'gender', 'phone', 'address', 'email', 'position', 'specialization', 'basic_salary'];
const PATIENT_FIELDS = ['fullname', 'dob', 'gender', 'phone', 'address', 'email', 'medical_history'];

// Chặn NoSQL injection: chỉ chấp nhận chuỗi không rỗng (vd: không cho {"$ne": null})
const isNonEmptyString = (v) => typeof v === 'string' && v.trim() !== '';

class AuthController {
  async register(req, res) {
    try {
      const { role, employee } = req.body || {};

      if (!STAFF_ROLES.includes(role)) {
        return res.status(400).json({ error: 'Vai trò không hợp lệ' });
      }
      if (!employee || typeof employee !== 'object' || Array.isArray(employee)) {
        return res.status(400).json({ error: 'Thiếu thông tin nhân viên' });
      }

      const createdEmployee = await EmployeeDAO.createEmployee(pickFields(employee, EMPLOYEE_FIELDS));

      const createdUser = await UserDAO.register(role, createdEmployee);

      return res.status(201).json({
        user: createdUser,
        employee: createdEmployee
      });
    } catch (err) {
      console.error('AuthController.register error:', err);
      if (err.message && err.message.includes('đã được sử dụng')) {
        return res.status(400).json({ error: err.message });
      }
      return res.status(500).json({ error: err.message });
    }
  };

  async login(req, res) {

    try {
      const { username, password } = req.body || {};
      if (!isNonEmptyString(username) || !isNonEmptyString(password)) return res.status(400).json({ message: 'Cần nhập đủ Username và Password' });
      const result = await UserDAO.login(username, password);

      // Lấy thông tin nhân viên vừa đăng nhập
      const employee = result.user.employee_id ? await EmployeeDAO.findById(result.user.employee_id) : null;
      const employeeObj = employee ? (employee.toObject ? employee.toObject() : employee) : null;

      return res.status(200).json({ user: result.user, token: result.token, employee: employeeObj });
    } catch (err) {
      console.error('AuthController.login error:', err.message);
      return res.status(err.status || 500).json({ error: err.message, message: err.message });
    }
  };

  async logout(req, res) {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) return res.status(400).json({ message: 'Không có token' });

      const token = authHeader.split(' ')[1];
      const result = await UserDAO.logout(token);

      return res.status(200).json(result);
    } catch (err) {
      console.error('AuthController.logout error:', err);
      return res.status(500).json({ error: err.message });
    }
  };

  async forgotPassword(req, res) {
    try {
      const { username, email } = req.body || {};

      if (!isNonEmptyString(username) || !isNonEmptyString(email)) {
        return res.status(400).json({ error: 'Username và email là bắt buộc' });
      }

      // URL công khai của backend để tạo link xác nhận trong email
      const confirmBaseUrl = (process.env.BACKEND_PUBLIC_URL ||
        `${req.get('x-forwarded-proto') || req.protocol}://${req.get('host')}`).replace(/\/+$/, '');

      const result = await UserDAO.forgotPassword(username, email, confirmBaseUrl);

      return res.status(200).json({
        message: 'Yêu cầu khôi phục mật khẩu đã được xử lý thành công',
        details: result.message
      });
    } catch (err) {
      console.error('AuthController.forgotPassword error:', err.message);
      return res.status(500).json({ error: 'Không thể xử lý yêu cầu, vui lòng thử lại sau' });
    }
  };

  // Link trong email quên mật khẩu trỏ vào đây (mở bằng trình duyệt) -> trả trang HTML đơn giản
  async confirmPasswordReset(req, res) {
    const loginUrl = (process.env.FRONTEND_URL || '').replace(/\/+$/, '');
    const page = (title, body) => `<!doctype html><html lang="vi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="font-family:system-ui,sans-serif;max-width:520px;margin:48px auto;padding:0 16px;line-height:1.6">
<h2>${title}</h2>${body}${loginUrl ? `<p><a href="${loginUrl}/auth/login">Về trang đăng nhập</a></p>` : ''}</body></html>`;

    try {
      const result = await UserDAO.confirmPasswordReset(req.query.token);
      res.set('Cache-Control', 'no-store').type('html');
      if (!result) {
        return res.status(400).send(page('Liên kết không hợp lệ', '<p>Liên kết đã hết hạn hoặc đã được sử dụng. Vui lòng gửi lại yêu cầu quên mật khẩu.</p>'));
      }
      if (result.password) {
        // Không gửi được email mật khẩu mới: hiển thị cho người giữ link (đã chứng minh sở hữu email)
        const safe = String(result.password).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
        return res.send(page('Đã đặt lại mật khẩu', `<p>Không gửi được email. Mật khẩu mới của bạn là: <strong>${safe}</strong></p><p>Hãy đổi mật khẩu ngay sau khi đăng nhập.</p>`));
      }
      return res.send(page('Đã đặt lại mật khẩu', '<p>Mật khẩu mới đã được gửi tới email của bạn.</p>'));
    } catch (err) {
      console.error('AuthController.confirmPasswordReset error:', err.message);
      return res.status(500).type('html').send(page('Có lỗi xảy ra', '<p>Vui lòng thử lại sau.</p>'));
    }
  };

  async getEmployee(req, res) {

    try {
      const employeeObj = await EmployeeDAO.findById(req.params.id);
      if (!employeeObj) return res.status(404).json({ message: 'Not found' });

      const userObj = await UserDAO.findEmployAcc(req.params.id);
      if (!userObj) return res.status(404).json({ message: 'Not found' });

      return res.status(200).json({ user: userObj, employee: employeeObj });
    } catch (err) {
      console.error('AuthController.login error:', err);
      return res.status(500).json({ error: err.message });
    }
  };

  async getAccount(req, res) {

    try {
      // Chỉ xem được tài khoản của chính mình (Admin xem được mọi tài khoản) — tránh lộ lương/thông tin cá nhân
      if (req.user?.role !== 'Admin' && String(req.user?.sub) !== String(req.params.id)) {
        return res.status(403).json({ message: 'Không có quyền xem tài khoản này' });
      }
      const userObj = await UserDAO.findById(req.params.id);
      if (!userObj) return res.status(404).json({ message: 'Not found' });

      const employeeObj = await EmployeeDAO.findById(userObj.employee_id);
      if (!employeeObj) return res.status(404).json({ message: 'Not found' });

      return res.status(200).json({ user: userObj, employee: employeeObj });
    } catch (err) {
      console.error('AuthController.login error:', err);
      return res.status(500).json({ error: err.message });
    }
  };

  // Kế thừa
  async updateAccount(req, res) {
    try {
      const requester = req.user || {};
      const requesterId = requester.sub || requester.userId || requester._id;

      if (requester.role !== 'Admin' && String(requesterId) !== String(req.params.id)) {
        return res.status(403).json({ message: 'Không có quyền cập nhật tài khoản này' });
      }

      const userObj = await UserDAO.findById(req.params.id);
      if (!userObj) {
        return res.status(404).json({ message: 'User not found' });
      }

      const allowedEmployeeFields = ['fullname', 'dob', 'phone', 'address', 'email'];
      const employeeUpdate = {};
      for (const key of allowedEmployeeFields) {
        if (req.body[key] !== undefined) employeeUpdate[key] = req.body[key];
      }

      let updatedEmployee = null;
      if (userObj.employee_id && Object.keys(employeeUpdate).length > 0) {
        updatedEmployee = await EmployeeDAO.update(
          userObj.employee_id,
          employeeUpdate
        );
      }

      const freshUser = await UserDAO.findById(req.params.id);
      const freshEmployee =
        updatedEmployee ||
        (userObj.employee_id ? await EmployeeDAO.findById(userObj.employee_id) : null);

      return res.status(200).json({ user: freshUser, employee: freshEmployee });

    } catch (err) {
      console.error('updateAccount error:', err);
      return res.status(500).json({ error: err.message });
    }
  };
  //

  async resetpass(req, res) {
    try {
      const result = await UserDAO.resetPassword(req.params.id);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };

  async registerPatient(req, res) {
    try {
      const { username, password, patient } = req.body || {};
      if (!isNonEmptyString(username) || !isNonEmptyString(password)) {
        return res.status(400).json({ error: 'Cần nhập đủ Username và Password' });
      }

      // Tạo patient (chỉ nhận các field thông tin cá nhân)
      const createdPatient = await PatientDAO.create(pickFields(patient, PATIENT_FIELDS));

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await UserDAO.create({
        username,
        password_hash: hashedPassword,
        role: 'Patient',
        patient_id: createdPatient._id
      });

      const userObj = user.toObject ? user.toObject() : { ...user };
      delete userObj.password_hash;

      return res.status(201).json({
        user: userObj,
        patient: createdPatient
      });

    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  };

  async loginPatient(req, res) {
    try {
      const { username, password } = req.body || {};
      if (!isNonEmptyString(username) || !isNonEmptyString(password)) return res.status(400).json({ message: 'Cần nhập đủ Username và Password' });
      const result = await UserDAO.login(username, password);

      // Lấy thông tin nhân viên vừa đăng nhập
      const patient = result.user.patient_id ? await PatientDAO.findById(result.user.patient_id) : null;
      const patientObj = patient ? (patient.toObject ? patient.toObject() : patient) : null;

      return res.status(200).json({ user: result.user, token: result.token, patient: patientObj });
    } catch (err) {
      console.error('AuthController.loginPatient error:', err.message);
      return res.status(err.status || 500).json({ error: err.message, message: err.message });
    }
  };

  async validateToken(req, res) {
    try {
      // Token is already validated by auth middleware
      // If we reach here, token is valid
      return res.status(200).json({
        valid: true,
        user: req.user
      });
    } catch (err) {
      console.error('AuthController.validateToken error:', err);
      return res.status(500).json({ error: err.message });
    }
  };
}

export default new AuthController();