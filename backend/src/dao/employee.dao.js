import Employee from "../models/employee.model.js";
import BaseDAO from './base.dao.js';
import { exactMatchRegex } from '../utils/import-parse.js';

let employeeModel = null;

class EmployeeDAO extends BaseDAO {
  async injectDB(conn) {
    if (employeeModel) return;
    employeeModel = Employee;
    return;
  }
  constructor() {
    super(Employee);
  }

  // Tạo employee từ front-end input (tạm chưa có shift_schedule)
  async createEmployee(data) {
    try {
      if (!employeeModel) throw new Error('Employee DAO has not been initialized. Call injectDB(conn) first.');
      // bỏ shift_schedule nếu bị dính data
      // const { shift_schedule, ...payload } = data || {};
      const doc = await employeeModel.create(data);
      return doc.toObject();
    } catch (e) {
      console.error('EmployeeDAO.createEmployee error:', e);
      throw e;
    }
  }

  async findById(id) {
    if (!employeeModel) throw new Error('Employee DAO has not been initialized. Call injectDB(conn) first.');
    return employeeModel.findById(id).exec();
  }

  async findDoc() {
    if (!employeeModel) throw new Error('Employee DAO has not been initialized. Call injectDB(conn) first.');
    return employeeModel.find({
          position: "Bác sĩ",
          disabled: false
        }).select("_id fullname email phone").exec();
  }

  async findByEmail(email, session = null) {
    if (!email || !String(email).trim()) return null;

    return Employee.findOne({
      email: { $regex: exactMatchRegex(email) },
      disabled: false
    }).session(session);
  }

  // Khớp nguyên họ tên (không phân biệt hoa thường), trả tối đa `limit` bản ghi
  // để nơi gọi phát hiện trùng tên thay vì gán nhầm nhân viên
  async findByExactName(name, limit = 2, session = null) {
    if (!name || !String(name).trim()) return [];

    return Employee.find({
      fullname: { $regex: exactMatchRegex(name) },
      disabled: false
    }).limit(limit).session(session);
  }
}

export default new EmployeeDAO()