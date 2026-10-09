import EmployeeDAO from "../dao/employee.dao.js";
import UserDAO from "../dao/user.dao.js";
import User from "../models/user.model.js";
import notificationDao from "../dao/notification.dao.js";

import errorStatus from '../utils/error-status.js';
const DEFAULT_SHIFT_START = "08:00";
const DEFAULT_SHIFT_END = "16:00";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;
const NOTIFY_ROLES = ["Admin", "Doctor", "Nurse", "Receptionist", "Accountant", "Pharmacist"];

// Các helper để ở mức module (không dùng this): router truyền handler dạng unbound
// Map role từ User sang position tiếng Việt
function mapRoleToPosition(role) {
    const roleMap = {
        "Receptionist": "Lễ tân",
        "Doctor": "Bác sĩ",
        "Nurse": "Y tá",
        "Accountant": "Kế toán",
        "Admin": "Admin"
    };
    return roleMap[role] || role || "N/A";
}

function resolvePosition(employee, user) {
    const position = employee?.position;
    if (typeof position === "string" && position.trim() !== "") return position;
    return user ? mapRoleToPosition(user.role) : "N/A";
}

// Ngày lịch thật (loại 2025-02-30) -> số ngày kể từ epoch, không hợp lệ -> null
function dayNumber(date) {
    if (typeof date !== "string" || !DATE_RE.test(date)) return null;
    const [y, m, d] = date.split("-").map(Number);
    const ms = Date.UTC(y, m - 1, d);
    const dt = new Date(ms);
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
    return ms / 86400000;
}

const toMinutes = (time) => {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
};

const isBlank = (v) => v === undefined || v === null || v === "";

// Chuẩn hóa + kiểm tra shift_schedule. Nhận mảng [{ date, start, end }] / mảng chuỗi ngày /
// object key theo ngày { "2025-10-23": { start, end } }. Trả { items } hoặc { error }.
// Ca qua đêm (end < start, vd 22:00-06:00) hợp lệ vì frontend cho phép; start === end thì không.
function parseShiftSchedule(raw) {
    let entries;
    if (Array.isArray(raw)) {
        entries = raw.map((item) => (typeof item === "string" ? { date: item } : item));
    } else if (raw && typeof raw === "object") {
        entries = Object.keys(raw).map((date) => {
            const val = raw[date];
            return val && typeof val === "object" ? { date, start: val.start, end: val.end } : { date };
        });
    } else {
        return { error: "shift_schedule phải là danh sách ca trực" };
    }

    const items = [];
    for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
            return { error: `Ca trực thứ ${i + 1} không hợp lệ` };
        }
        const date = entry.date ?? entry.day ?? entry.dateStr;
        const day = dayNumber(date);
        if (day === null) {
            return { error: `Ngày trực "${date ?? ""}" không hợp lệ (định dạng YYYY-MM-DD)` };
        }
        const start = isBlank(entry.start) ? DEFAULT_SHIFT_START : entry.start;
        const end = isBlank(entry.end) ? DEFAULT_SHIFT_END : entry.end;
        if (typeof start !== "string" || typeof end !== "string" || !TIME_RE.test(start) || !TIME_RE.test(end)) {
            return { error: `Giờ trực ngày ${date} không hợp lệ (định dạng HH:mm)` };
        }
        if (start === end) {
            return { error: `Giờ bắt đầu và kết thúc ca trực ngày ${date} không được trùng nhau` };
        }
        const from = day * 1440 + toMinutes(start);
        const to = day * 1440 + toMinutes(end) + (end < start ? 1440 : 0);
        // Chỉ giữ 3 field, bỏ _id và các key lạ
        items.push({ item: { date, start, end }, from, to });
    }

    const sorted = [...items].sort((a, b) => a.from - b.from);
    for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1];
        const cur = sorted[i];
        if (cur.from < prev.to) {
            return {
                error: `Ca trực ngày ${cur.item.date} (${cur.item.start}-${cur.item.end}) bị trùng với ca ngày ${prev.item.date} (${prev.item.start}-${prev.item.end})`,
            };
        }
    }
    return { items: items.map((x) => x.item) };
}

// Gửi thông báo TRƯỚC khi trả response (trên serverless, việc chạy sau response có thể bị dừng);
// lỗi thông báo chỉ ghi log, không làm hỏng request.
// Nếu client truyền `notify_roles` thì dùng các role đó, ngược lại chỉ gửi cho role của employee (nếu biết).
async function notifyScheduleUpdated(body, user, employee) {
    try {
        let rolesToNotify = [];
        if (Array.isArray(body?.notify_roles) && body.notify_roles.length > 0) {
            rolesToNotify = [...new Set(body.notify_roles.filter((r) => typeof r === "string" && NOTIFY_ROLES.includes(r)))];
        }
        if (rolesToNotify.length === 0 && user && NOTIFY_ROLES.includes(user.role)) {
            rolesToNotify = [user.role];
        }
        if (rolesToNotify.length === 0) return;

        const employeeName = employee.fullname || "nhân viên";
        await Promise.all(
            rolesToNotify.map((r) =>
                notificationDao.createForRole(r, {
                    type: "schedule_updated",
                    title: "Lịch trực được cập nhật",
                    message: `Admin đã cập nhật lịch trực của ${employeeName}.`,
                    related_id: employee._id,
                    related_type: "schedule",
                })
            )
        );
    } catch (notifErr) {
        console.error("❌ [Schedule] Error creating notifications for roles:", notifErr);
    }
}

// Ghi shift_schedule đã kiểm tra, gửi thông báo rồi trả về dữ liệu cho response (null nếu không tìm thấy nhân viên)
async function saveSchedule(employeeId, items, body) {
    const updated = await EmployeeDAO.update(employeeId, {
        shift_schedule: items,
        updated_at: new Date(),
    });
    if (!updated) return null;

    // Lấy user để map role sang position nếu cần
    const user = await UserDAO.findEmployAcc(employeeId);
    await notifyScheduleUpdated(body, user, updated);

    return {
        employee_id: updated._id,
        employee_name: updated.fullname,
        employee_position: resolvePosition(updated, user),
        shift_schedule: updated.shift_schedule,
    };
}

// Kế thừa
class ScheduleController {
    // GET /api/schedules - Lấy tất cả lịch trực (Admin) hoặc lịch trực của chính mình (others)
    async findAll(req, res) {
        try {
            const userRole = req.user.role;
            const userId = req.user.sub; // user id từ token

            // Nếu là Admin, lấy tất cả employees với shift_schedule
            if (userRole === "Admin") {
                const employees = await EmployeeDAO.findAll();
                const employeesWithSchedule = employees.filter((emp) => emp.shift_schedule);

                // Lấy thông tin user chỉ cho các employees có schedule để tối ưu
                const employeeIds = employeesWithSchedule.map(emp => emp._id);
                const users = await User.find({ employee_id: { $in: employeeIds } }).select('employee_id role').exec();
                const userMap = new Map(users.map(u => [u.employee_id?.toString(), u]));

                const schedules = employeesWithSchedule.map((emp) => ({
                    employee_id: emp._id,
                    employee_name: emp.fullname,
                    // Ưu tiên dùng position từ employee, fallback sang role từ user
                    employee_position: resolvePosition(emp, userMap.get(emp._id.toString())),
                    shift_schedule: emp.shift_schedule,
                }));
                return res.json(schedules);
            }

            // Nếu không phải Admin, chỉ lấy lịch trực của chính mình
            const user = await UserDAO.findById(userId);
            if (!user || !user.employee_id) {
                return res
                    .status(404)
                    .json({ message: "Không tìm thấy thông tin nhân viên" });
            }

            const employee = await EmployeeDAO.findById(user.employee_id);
            if (!employee) {
                return res.status(404).json({ message: "Không tìm thấy nhân viên" });
            }

            return res.json([
                {
                    employee_id: employee._id,
                    employee_name: employee.fullname,
                    employee_position: resolvePosition(employee, user),
                    shift_schedule: employee.shift_schedule || null,
                },
            ]);
        } catch (err) {
            console.error("ScheduleController.findAll error:", err);
            return res.status(errorStatus(err)).json({ error: err.message });
        }
    }

    // GET /api/schedules/:employee_id - Lấy lịch trực của một nhân viên cụ thể
    async findByEmployeeId(req, res) {
        try {
            const userRole = req.user.role;
            const userId = req.user.sub;
            const { employee_id } = req.params;

            // Nếu không phải Admin, kiểm tra xem có phải lịch trực của chính mình không
            if (userRole !== "Admin") {
                const user = await UserDAO.findById(userId);
                if (
                    !user ||
                    !user.employee_id ||
                    user.employee_id.toString() !== employee_id
                ) {
                    return res.status(403).json({
                        message: "Không có quyền xem lịch trực của nhân viên này",
                    });
                }
            }

            if (!OBJECT_ID_RE.test(employee_id)) {
                return res.status(400).json({ error: "employee_id không hợp lệ" });
            }
            const employee = await EmployeeDAO.findById(employee_id);
            if (!employee) {
                return res.status(404).json({ message: "Không tìm thấy nhân viên" });
            }

            // Lấy user để map role sang position nếu cần
            const user = await UserDAO.findEmployAcc(employee_id);

            return res.json({
                employee_id: employee._id,
                employee_name: employee.fullname,
                employee_position: resolvePosition(employee, user),
                shift_schedule: employee.shift_schedule || null,
            });
        } catch (err) {
            console.error("ScheduleController.findByEmployeeId error:", err);
            return res.status(errorStatus(err)).json({ error: err.message });
        }
    }

    // POST /api/schedules - Tạo/cập nhật lịch trực (chỉ Admin)
    async create(req, res) {
        try {
            const { employee_id, shift_schedule } = req.body || {};

            if (!employee_id) {
                return res.status(400).json({ message: "Cần cung cấp employee_id", error: "Cần cung cấp employee_id" });
            }
            if (typeof employee_id !== "string" || !OBJECT_ID_RE.test(employee_id)) {
                return res.status(400).json({ error: "employee_id không hợp lệ" });
            }

            // Thiếu/sai shift_schedule -> 400, không ghi [] đè mất toàn bộ lịch trực
            const parsed = parseShiftSchedule(shift_schedule);
            if (parsed.error) {
                return res.status(400).json({ error: parsed.error });
            }

            const employee = await EmployeeDAO.findById(employee_id);
            if (!employee) {
                return res.status(404).json({ message: "Không tìm thấy nhân viên" });
            }

            const result = await saveSchedule(employee_id, parsed.items, req.body);
            if (!result) {
                return res.status(404).json({ message: "Không tìm thấy nhân viên" });
            }
            return res.status(201).json(result);
        } catch (err) {
            console.error("ScheduleController.create error:", err);
            return res.status(errorStatus(err)).json({ error: err.message });
        }
    }

    // PUT /api/schedules/:employee_id - Cập nhật lịch trực (chỉ Admin)
    async update(req, res) {
        try {
            const { employee_id } = req.params;
            const { shift_schedule } = req.body || {};

            if (!OBJECT_ID_RE.test(employee_id)) {
                return res.status(400).json({ error: "employee_id không hợp lệ" });
            }

            // Thiếu/sai shift_schedule -> 400, không ghi [] đè mất toàn bộ lịch trực
            // (muốn xóa hết thì dùng DELETE hoặc gửi mảng rỗng)
            const parsed = parseShiftSchedule(shift_schedule);
            if (parsed.error) {
                return res.status(400).json({ error: parsed.error });
            }

            const employee = await EmployeeDAO.findById(employee_id);
            if (!employee) {
                return res.status(404).json({ message: "Không tìm thấy nhân viên" });
            }

            const result = await saveSchedule(employee_id, parsed.items, req.body);
            if (!result) {
                return res.status(404).json({ message: "Không tìm thấy nhân viên" });
            }
            return res.json(result);
        } catch (err) {
            console.error("ScheduleController.update error:", err);
            return res.status(errorStatus(err)).json({ error: err.message });
        }
    }

    // DELETE /api/schedules/:employee_id - Xóa lịch trực (chỉ Admin)
    async remove(req, res) {
        try {
            const { employee_id } = req.params;

            if (!OBJECT_ID_RE.test(employee_id)) {
                return res.status(400).json({ error: "employee_id không hợp lệ" });
            }
            const employee = await EmployeeDAO.findById(employee_id);
            if (!employee) {
                return res.status(404).json({ message: "Không tìm thấy nhân viên" });
            }

            // Xóa shift_schedule (set về mảng rỗng)
            await EmployeeDAO.update(employee_id, {
                shift_schedule: [],
                updated_at: new Date(),
            });

            return res.json({ message: "Đã xóa lịch trực thành công" });
        } catch (err) {
            console.error("ScheduleController.remove error:", err);
            return res.status(errorStatus(err)).json({ error: err.message });
        }
    }
}
//
export default new ScheduleController();
