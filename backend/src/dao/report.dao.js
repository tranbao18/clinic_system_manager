import Invoice from '../models/invoice.model.js';
import Payment from '../models/payment.model.js';
import MedicineImport from '../models/medicine-import.model.js';
import PurchaseTransaction from '../models/purchase-transaction.model.js';
import Payroll from '../models/payroll.model.js';
import { APP_TIMEZONE } from '../config/timezone.js';

// Tồn kho "dùng được" = lô còn hạn (cùng quy tắc với xuất kho FEFO); lô hết hạn / không có hạn dùng tính riêng
const usableIf = (now, expr) => ({ $cond: [{ $gte: ["$expiry_date", now] }, expr, 0] });
const expiredIf = (now, expr) => ({ $cond: [{ $gte: ["$expiry_date", now] }, 0, expr] });
const stockValue = { $multiply: ["$remaining", "$unit_price"] };

function inventoryGroup(id, now) {
  return {
    $group: {
      _id: id,
      total_remaining: { $sum: usableIf(now, "$remaining") },
      total_value: { $sum: usableIf(now, stockValue) },
      expired_remaining: { $sum: expiredIf(now, "$remaining") },
      expired_value: { $sum: expiredIf(now, stockValue) }
    }
  };
}

// Khoảng thời gian luôn là [start, endExclusive); nhóm theo ngày/tháng/năm theo giờ Việt Nam
function sumByPeriod(Model, dateField, amountField, start, endExclusive, format) {
  return Model.aggregate([
    { $match: { [dateField]: { $gte: start, $lt: endExclusive }, disabled: false } },
    {
      $group: {
        _id: { $dateToString: { format, date: `$${dateField}`, timezone: APP_TIMEZONE } },
        total: { $sum: `$${amountField}` }
      }
    },
    { $sort: { _id: 1 } }
  ]);
}

class ReportDAO {
  async getMedicineInventoryList() {
    return await MedicineImport.aggregate([
      { $match: { disabled: false } },
      inventoryGroup("$medicine_id", new Date()),
      {
        $lookup: {
          from: "medicines",
          localField: "_id",
          foreignField: "_id",
          as: "medicine"
        }
      },
      { $unwind: "$medicine" },
      {
        $project: {
          _id: 0,
          medicine_id: "$medicine._id",
          name: "$medicine.name",
          unit: "$medicine.unit",
          total_remaining: 1,
          total_value: 1,
          expired_remaining: 1,
          expired_value: 1
        }
      }
    ]);
  }
  async getInventoryTotals() {
    const [result] = await MedicineImport.aggregate([
      { $match: { disabled: false } },
      inventoryGroup(null, new Date())
    ]);

    return {
      total_remaining: result?.total_remaining || 0,
      total_value: result?.total_value || 0,
      expired_remaining: result?.expired_remaining || 0,
      expired_value: result?.expired_value || 0
    };
  }

  // 1) Gom theo ngày
  async getPaymentsByDateRange(start, endExclusive) {
    return sumByPeriod(Payment, "date", "amount", start, endExclusive, "%Y-%m-%d");
  }
  async getMedicinePurchaseByDateRange(start, endExclusive) {
    return sumByPeriod(PurchaseTransaction, "date", "amount", start, endExclusive, "%Y-%m-%d");
  }
  async getPayrollByDateRange(start, endExclusive) {
    return sumByPeriod(Payroll, "paydate", "net_salary", start, endExclusive, "%Y-%m-%d");
  }
  async getFinancialSummary(start, endExclusive) {
    const [income, medicineCost, payrollCost] = await Promise.all([
      this.getPaymentsByDateRange(start, endExclusive),
      this.getMedicinePurchaseByDateRange(start, endExclusive),
      this.getPayrollByDateRange(start, endExclusive)
    ]);

    return { income, medicineCost, payrollCost };
  }

  // 2) Gom theo tháng (YYYY-MM)
  async getPaymentsByMonth(start, endExclusive) {
    return sumByPeriod(Payment, "date", "amount", start, endExclusive, "%Y-%m");
  }
  async getMedicinePurchaseByMonth(start, endExclusive) {
    return sumByPeriod(PurchaseTransaction, "date", "amount", start, endExclusive, "%Y-%m");
  }
  async getPayrollByMonth(start, endExclusive) {
    return sumByPeriod(Payroll, "paydate", "net_salary", start, endExclusive, "%Y-%m");
  }
  async getFinancialSummaryByMonth(start, endExclusive) {
    const [income, medicineCost, payrollCost] = await Promise.all([
      this.getPaymentsByMonth(start, endExclusive),
      this.getMedicinePurchaseByMonth(start, endExclusive),
      this.getPayrollByMonth(start, endExclusive)
    ]);

    return { income, medicineCost, payrollCost };
  }

  // 3) Gom theo năm (YYYY)
  async getPaymentsByYear(start, endExclusive) {
    return sumByPeriod(Payment, "date", "amount", start, endExclusive, "%Y");
  }
  async getMedicinePurchaseByYear(start, endExclusive) {
    return sumByPeriod(PurchaseTransaction, "date", "amount", start, endExclusive, "%Y");
  }
  async getPayrollByYear(start, endExclusive) {
    return sumByPeriod(Payroll, "paydate", "net_salary", start, endExclusive, "%Y");
  }
  async getFinancialSummaryByYear(start, endExclusive) {
    const [income, medicineCost, payrollCost] = await Promise.all([
      this.getPaymentsByYear(start, endExclusive),
      this.getMedicinePurchaseByYear(start, endExclusive),
      this.getPayrollByYear(start, endExclusive)
    ]);

    return { income, medicineCost, payrollCost };
  }

  mapByKey(arr = []) {
    return Object.fromEntries(arr.map(d => [d._id, d.total]));
  }
}

export default new ReportDAO();
