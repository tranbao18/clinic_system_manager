import XLSX from "xlsx";

import ReportDAO from "../dao/report.dao.js";

// Giới hạn độ dài khoảng thời gian: tránh vòng lặp/aggregate khổng lồ (vd: 1970 → 9999)
const MAX_DAILY_DAYS = 2000;
const MAX_MONTHS = 60;
const MAX_YEARS = 20;

const badRequest = (message) => Object.assign(new Error(message), { status: 400 });
const pad = (n) => String(n).padStart(2, "0");

// Ngày/tháng tính theo giờ local của process (đã đặt Asia/Ho_Chi_Minh trong src/config/timezone.js)
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const monthKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

// "YYYY-MM-DD" là 1 ngày theo giờ Việt Nam (new Date("YYYY-MM-DD") lại là 0h UTC = 7h sáng VN)
function parseDay(value, name) {
  const s = typeof value === "string" ? value.trim() : "";
  let d = null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) {
    const [y, mo, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
    d = new Date(y, mo - 1, day);
    if (d.getFullYear() !== y || d.getMonth() !== mo - 1 || d.getDate() !== day) d = null;
  } else if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const t = new Date(s);
    if (!Number.isNaN(t.getTime())) d = new Date(t.getFullYear(), t.getMonth(), t.getDate());
  }
  if (!d || d.getFullYear() < 1970 || d.getFullYear() > 9999) {
    throw badRequest(`${name} không hợp lệ (định dạng YYYY-MM-DD)`);
  }
  return d;
}

// Trả về khoảng [start, endExclusive): từ 0h ngày bắt đầu đến 0h ngày sau ngày kết thúc
function parseDateRange(query, unit) {
  const start = parseDay(query.startDate, "startDate");
  const end = parseDay(query.endDate, "endDate");
  if (start > end) throw badRequest("startDate phải trước hoặc bằng endDate");

  const endExclusive = addDays(end, 1);
  if (unit === "day") {
    const days = Math.round((endExclusive - start) / 86400000);
    if (days > MAX_DAILY_DAYS) throw badRequest(`Khoảng thời gian tối đa ${MAX_DAILY_DAYS} ngày`);
  } else {
    const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
    if (months > MAX_MONTHS) throw badRequest(`Khoảng thời gian tối đa ${MAX_MONTHS / 12} năm`);
  }
  return { start, endExclusive };
}

function parseYearRange(startYear, endYear) {
  const parseYear = (value, name) => {
    const s = String(value ?? "").trim();
    if (!/^\d{4}$/.test(s) || Number(s) < 1970) throw badRequest(`${name} không hợp lệ (định dạng YYYY)`);
    return Number(s);
  };
  const from = parseYear(startYear, "startYear");
  const to = parseYear(endYear, "endYear");
  if (from > to) throw badRequest("startYear phải nhỏ hơn hoặc bằng endYear");
  if (to - from + 1 > MAX_YEARS) throw badRequest(`Khoảng thời gian tối đa ${MAX_YEARS} năm`);
  return { from, to, start: new Date(from, 0, 1), endExclusive: new Date(to + 1, 0, 1) };
}

function dayKeys(start, endExclusive) {
  const keys = [];
  for (let d = start; d < endExclusive; d = addDays(d, 1)) keys.push(dayKey(d));
  return keys;
}

// Duyệt từ ngày 1 của mỗi tháng: tránh setMonth(+1) từ ngày 31 làm nhảy cóc tháng 2
function monthKeys(start, endExclusive) {
  const keys = [];
  for (let d = new Date(start.getFullYear(), start.getMonth(), 1); d < endExclusive; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
    keys.push(monthKey(d));
  }
  return keys;
}

function yearKeys(from, to) {
  const keys = [];
  for (let year = from; year <= to; year++) keys.push(`${year}`);
  return keys;
}

// Ghép thu/chi theo từng key (ngày/tháng/năm), kể cả key không có phát sinh
function buildProfitLoss(keys, { income, medicineCost, payrollCost }) {
  const incomeMap = ReportDAO.mapByKey(income);
  const medicineMap = ReportDAO.mapByKey(medicineCost);
  const payrollMap = ReportDAO.mapByKey(payrollCost);

  const result = {};
  for (const key of keys) {
    const thu = incomeMap[key] || 0;
    const chiThuoc = medicineMap[key] || 0;
    const chiLuong = payrollMap[key] || 0;
    result[key] = {
      income: thu,
      medicineCost: chiThuoc,
      payrollCost: chiLuong,
      profit: thu - (chiThuoc + chiLuong)
    };
  }
  return result;
}

const escapeHtml = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

class ReportController {
  async getMedicineInventory(req, res) {
    try {
      const list = await ReportDAO.getMedicineInventoryList();
      return res.json({
        success: true,
        data: list
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false });
    }
  }
  async getTotalMedicineQuantity(req, res) {
    try {
      const totals = await ReportDAO.getInventoryTotals();
      return res.json({
        success: true,
        total_quantity: totals.total_remaining,
        expired_quantity: totals.expired_remaining
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false });
    }
  }
  async getTotalMedicineValue(req, res) {
    try {
      const totals = await ReportDAO.getInventoryTotals();
      return res.json({
        success: true,
        total_value: totals.total_value,
        expired_value: totals.expired_value
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false });
    }
  }

  // 1) API thu – chi
  async getCashflow(req, res) {
    try {
      const { startDate, endDate } = req.query;
      const { start, endExclusive } = parseDateRange(req.query, "day");

      const data = await ReportDAO.getFinancialSummary(start, endExclusive);

      return res.json({
        success: true,
        range: `${startDate} → ${endDate}`,
        data
      });
    } catch (err) {
      if (err.status === 400) return res.status(400).json({ success: false, error: err.message });
      console.log(err);
      return res.status(500).json({ success: false });
    }
  }
  async getCashflowByMonth(req, res) {
    try {
      const { startDate, endDate } = req.query;
      const { start, endExclusive } = parseDateRange(req.query, "month");

      const data = await ReportDAO.getFinancialSummaryByMonth(start, endExclusive);

      return res.json({
        success: true,
        type: "monthly",
        range: `${startDate} → ${endDate}`,
        data
      });
    } catch (err) {
      if (err.status === 400) return res.status(400).json({ success: false, error: err.message });
      console.log(err);
      return res.status(500).json({ success: false });
    }
  }
  async getCashflowByYear(req, res) {
    try {
      const { startYear, endYear } = req.query;
      const { start, endExclusive } = parseYearRange(startYear, endYear);

      const data = await ReportDAO.getFinancialSummaryByYear(start, endExclusive);

      return res.json({
        success: true,
        type: "yearly",
        range: `${startYear} → ${endYear}`,
        data
      });
    } catch (err) {
      if (err.status === 400) return res.status(400).json({ success: false, error: err.message });
      console.log(err);
      return res.status(500).json({ success: false });
    }
  }

  // 2) API tính lãi/lỗ
  async getProfitLossDaily(req, res) {
    try {
      const { start, endExclusive } = parseDateRange(req.query, "day");
      const summary = await ReportDAO.getFinancialSummary(start, endExclusive);

      return res.json({
        success: true,
        type: "profit-loss-daily",
        data: buildProfitLoss(dayKeys(start, endExclusive), summary)
      });
    } catch (err) {
      if (err.status === 400) return res.status(400).json({ success: false, error: err.message });
      console.log(err);
      return res.status(500).json({ success: false });
    }
  }
  async getProfitLossMonthly(req, res) {
    try {
      const { start, endExclusive } = parseDateRange(req.query, "month");
      const summary = await ReportDAO.getFinancialSummaryByMonth(start, endExclusive);

      return res.json({
        success: true,
        type: "profit-loss-monthly",
        data: buildProfitLoss(monthKeys(start, endExclusive), summary) // YYYY-MM → data
      });
    } catch (err) {
      if (err.status === 400) return res.status(400).json({ success: false, error: err.message });
      console.log(err);
      return res.status(500).json({ success: false });
    }
  }
  async getProfitLossYearly(req, res) {
    try {
      const { from, to, start, endExclusive } = parseYearRange(req.query.startYear, req.query.endYear);
      const summary = await ReportDAO.getFinancialSummaryByYear(start, endExclusive);

      return res.json({
        success: true,
        type: "profit-loss-yearly",
        data: buildProfitLoss(yearKeys(from, to), summary) // YYYY → data
      });
    } catch (err) {
      if (err.status === 400) return res.status(400).json({ success: false, error: err.message });
      console.log(err);
      return res.status(500).json({ success: false });
    }
  }

  // Kế thừa
  // Export report (CSV or HTML for PDF printing)
  // GET /api/reports/export?type=medicine-inventory|profit-loss-monthly|cashflow&format=csv|pdf&startDate=...&endDate=...
  async exportReport(req, res) {
    try {
      const { type, format = "csv" } = req.query;

      const sendCSV = (filename, headers, rows) => {
        const esc = (v) => {
          if (v === null || v === undefined) return "";
          let s = String(v);
          // Chặn CSV injection: ô chữ bắt đầu bằng = + - @ (tab/CR) bị Excel hiểu là công thức
          if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
          if (/[",\n\r]/.test(s)) {
            return `"${s.replace(/"/g, '""')}"`;
          }
          return s;
        };
        const csvLines = [];
        csvLines.push(headers.map(esc).join(","));
        for (const row of rows) {
          csvLines.push(row.map(esc).join(","));
        }
        const csv = csvLines.join("\n");
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        return res.send(csv);
      };

      const sendXLSX = (filename, headers, rows) => {
        // Build sheet as array of arrays (with headers first)
        const aoa = [headers, ...rows];
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Report");
        const buf = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });
        res.setHeader(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        return res.send(Buffer.from(buf));
      };

      // Mọi giá trị đưa vào HTML đều được escape (tên thuốc do người dùng nhập)
      const sendHTMLTable = (title, columns, rows) => {
        const head = columns.map((c) => `<th>${escapeHtml(c)}</th>`).join("");
        const body = rows.map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join("")}</tr>`).join("");
        const html = `
          <!doctype html>
          <html>
            <head>
              <meta charset="utf-8"/>
              <title>${escapeHtml(title)}</title>
              <style>
                body { font-family: Arial, sans-serif; padding: 20px; color: #111; }
                table { border-collapse: collapse; width: 100%; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background: #f5f5f5; }
              </style>
            </head>
            <body>
              <h1>${escapeHtml(title)}</h1>
              <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
            </body>
          </html>
        `;
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        return res.send(html);
      };

      const send = (name, title, headers, columns, rows) => {
        if (format === "csv") return sendCSV(`${name}.csv`, headers, rows);
        if (format === "xlsx" || format === "excel") return sendXLSX(`${name}.xlsx`, headers, rows);
        return sendHTMLTable(title, columns, rows);
      };

      if (!type) return res.status(400).json({ error: "Missing report type" });

      if (type === "medicine-inventory" || type === "medicine-inventory-quantity" || type === "medicine-inventory-value") {
        const list = await ReportDAO.getMedicineInventoryList();
        // support subtypes: full, quantity-only, value-only
        if (type === "medicine-inventory-quantity") {
          const rows = (list || []).map((r) => [r.name || "", r.unit || "", r.total_remaining || 0]);
          return send("medicine_inventory_quantity", "Medicine Inventory Quantity Report",
            ["name", "unit", "total_remaining"], ["Tên", "Đơn vị", "Tồn"], rows);
        }

        if (type === "medicine-inventory-value") {
          const rows = (list || []).map((r) => [r.name || "", r.unit || "", r.total_value || 0]);
          return send("medicine_inventory_value", "Medicine Inventory Value Report",
            ["name", "unit", "total_value"], ["Tên", "Đơn vị", "Giá trị"], rows);
        }

        // default: full inventory with both fields
        const rows = (list || []).map((r) => [r.name || "", r.unit || "", r.total_remaining || 0, r.total_value || 0]);
        return send("medicine_inventory", "Medicine Inventory Report",
          ["name", "unit", "total_remaining", "total_value"], ["Tên", "Đơn vị", "Tồn", "Giá trị"], rows);
      }

      if (type === "profit-loss-monthly") {
        const { start, endExclusive } = parseDateRange(req.query, "month");
        const result = buildProfitLoss(monthKeys(start, endExclusive), await ReportDAO.getFinancialSummaryByMonth(start, endExclusive));
        const rows = Object.keys(result).map((k) => [k, result[k].income, result[k].medicineCost, result[k].payrollCost, result[k].profit]);
        return send("profit_loss_monthly", "Profit/Loss Monthly Report",
          ["month", "income", "medicineCost", "payrollCost", "profit"], ["Month", "Income", "Medicine Cost", "Payroll Cost", "Profit"], rows);
      }

      if (type === "cashflow") {
        const { start, endExclusive } = parseDateRange(req.query, "day");
        const result = buildProfitLoss(dayKeys(start, endExclusive), await ReportDAO.getFinancialSummary(start, endExclusive));
        const rows = Object.keys(result).map((k) => [k, result[k].income, result[k].medicineCost, result[k].payrollCost]);
        return send("cashflow_report", "Cashflow Report",
          ["date", "income", "medicineCost", "payrollCost"], ["Date", "Income", "Medicine Cost", "Payroll Cost"], rows);
      }

      if (type === "profit-loss-yearly") {
        // support exporting yearly profit/loss by providing startYear & endYear or default to current year
        const startYear = req.query.startYear || new Date().getFullYear();
        const endYear = req.query.endYear || startYear;
        const { from, to, start, endExclusive } = parseYearRange(startYear, endYear);
        const result = buildProfitLoss(yearKeys(from, to), await ReportDAO.getFinancialSummaryByYear(start, endExclusive));
        const rows = Object.keys(result).map((k) => [k, result[k].income, result[k].medicineCost, result[k].payrollCost, result[k].profit]);
        return send("profit_loss_yearly", "Profit/Loss Yearly Report",
          ["year", "income", "medicineCost", "payrollCost", "profit"], ["Year", "Income", "Medicine Cost", "Payroll Cost", "Profit"], rows);
      }

      return res.status(400).json({ error: "Unsupported report type" });
    } catch (err) {
      if (err.status === 400) return res.status(400).json({ error: err.message });
      console.error("Export report error:", err);
      return res.status(500).json({ error: err.message || "Export failed" });
    }
  }
  //
}

export default new ReportController();
