"use client";

import { useEffect, useMemo, useState } from "react";
import ReportCard from "@/components/layout/ReportCard";
import {
    DollarOutlined,
    TeamOutlined,
    MedicineBoxOutlined,
} from "@ant-design/icons";
import {
    LineChart,
    PieChart,
    pieArcLabelClasses,
} from "@mui/x-charts";
import { Box } from "@mui/material";
import { Spin, Select, Button, InputNumber, Modal } from "antd";
import { getAuthHeaderClient } from "@/lib/authHeaderClient";

interface InventoryItem {
    medicine_id: string;
    name: string;
    unit: string;
    total_remaining: number;
    total_value: number;
}

interface ProfitLossMonthlyResponse {
    success: boolean;
    type: string;
    data: Record<
        string,
        {
            income: number;
            medicineCost: number;
            payrollCost: number;
            profit: number;
        }
    >;
}

export default function ReportsPage() {
    const [loading, setLoading] = useState(true);
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [totalQuantity, setTotalQuantity] = useState<number>(0);
    const [totalValue, setTotalValue] = useState<number>(0);
    const [monthlyProfitLoss, setMonthlyProfitLoss] =
        useState<ProfitLossMonthlyResponse | null>(null);
    const [reportType, setReportType] = useState<string>("medicine-inventory-value");
    const [exportYear, setExportYear] = useState<number>(() => new Date().getFullYear());

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);

                const now = new Date();
                const year = now.getFullYear();
                const startDate = `${year}-01-01`;
                const endDate = `${year}-12-31`;

                const authHeaders = await getAuthHeaderClient();
                const [invRes, qtyRes, valRes, plRes] = await Promise.all([
                    fetch("/api/reports/medicine/inventory", { headers: authHeaders }),
                    fetch("/api/reports/medicine/inventory/quantity", { headers: authHeaders }),
                    fetch("/api/reports/medicine/inventory/value", { headers: authHeaders }),
                    fetch(`/api/reports/profit-loss/monthly?startDate=${startDate}&endDate=${endDate}`, { headers: authHeaders }),
                ]);

                const invData = await invRes.json();
                const qtyData = await qtyRes.json();
                const valData = await valRes.json();
                const plData = await plRes.json();

                if (!invRes.ok) {
                    throw new Error(invData.error || "Không thể lấy tồn kho thuốc");
                }
                if (!qtyRes.ok) {
                    throw new Error(qtyData.error || "Không thể lấy tổng số lượng tồn kho");
                }
                if (!valRes.ok) {
                    throw new Error(valData.error || "Không thể lấy tổng giá trị tồn kho");
                }
                if (!plRes.ok) {
                    throw new Error(plData.error || "Không thể lấy báo cáo lãi/lỗ theo tháng");
                }

                setInventory(invData.data || []);
                setTotalQuantity(qtyData.total_quantity || 0);
                setTotalValue(valData.total_value || 0);
                setMonthlyProfitLoss(plData);
            } catch (err: any) {
                console.error("Fetch report data error:", err);
                showError(err.message || "Không thể tải dữ liệu báo cáo");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);


    const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "https://meppod.onrender.com";

    const downloadBlob = async (url: string, filenameFallback: string) => {
        const fullUrl = API_BASE ? `${API_BASE}${url}` : url;
        const authHeader = getAuthHeaderClient();
        const headers: Record<string, string> = { Accept: "*/*" };
        if ((authHeader as any).Authorization) {
            headers.Authorization = (authHeader as any).Authorization;
        }
        const res = await fetch(fullUrl, {
            headers,
        });
        if (!res.ok) {
            const contentType = res.headers.get("content-type") || "";
            let errMsg = "Download failed";
            try {
                if (contentType.includes("application/json")) {
                    const errJson = await res.json();
                    errMsg = errJson?.error || errJson?.message || JSON.stringify(errJson);
                } else {
                    const txt = await res.text();
                    errMsg = txt ? (txt.length > 300 ? txt.slice(0, 300) + "..." : txt) : errMsg;
                }
            } catch (e) {
            }
            throw new Error(errMsg || "Download failed");
        }

        const blob = await res.blob();
        const disposition = res.headers.get("content-disposition") || "";
        let filename = filenameFallback;
        const match = /filename="?(.*?)"?($|;)/.exec(disposition);
        if (match && match[1]) filename = match[1];
        const urlBlob = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = urlBlob;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(urlBlob);
    };


    const showError = (msg: string) => {
        Modal.error({ title: "Lỗi", content: msg });
    };

    const showSuccess = (msg: string) => {
        Modal.success({ title: "Thành công", content: msg });
    };

    const { xLabels, incomeSeries, expenseSeries } = useMemo(() => {
        if (!monthlyProfitLoss || !monthlyProfitLoss.data) {
            return { xLabels: [], incomeSeries: [], expenseSeries: [] };
        }

        const keys = Object.keys(monthlyProfitLoss.data).sort(); // YYYY-MM
        const incomeSeries = keys.map(
            (k) => monthlyProfitLoss.data[k].income || 0
        );
        const expenseSeries = keys.map((k) => {
            const d = monthlyProfitLoss.data[k];
            return (d.medicineCost || 0) + (d.payrollCost || 0);
        });

        const xLabels = keys.map((k) => {
            const month = Number(k.slice(5, 7));
            return `Th${month}`;
        });

        return { xLabels, incomeSeries, expenseSeries };
    }, [monthlyProfitLoss]);

    const stockData = useMemo(() => {
        if (!inventory || inventory.length === 0) return [];
        const sorted = [...inventory].sort(
            (a, b) => b.total_remaining - a.total_remaining
        );
        const top = sorted.slice(0, 5);
        const others = sorted.slice(5);

        const total = inventory.reduce(
            (sum, item) => sum + (item.total_remaining || 0),
            0
        );

        const data = top.map((item, idx) => ({
            id: idx,
            value: item.total_remaining,
            label: item.name,
        }));

        const otherTotal = others.reduce(
            (sum, item) => sum + (item.total_remaining || 0),
            0
        );
        if (otherTotal > 0) {
            data.push({
                id: data.length,
                value: otherTotal,
                label: "Khác",
            });
        }

        if (total === 0) {
            return data;
        }

        return data;
    }, [inventory]);

    const reportData = [
        {
            title: "Tổng giá trị tồn kho",
            value: new Intl.NumberFormat("vi-VN", {
                style: "currency",
                currency: "VND",
            }).format(totalValue || 0),
            icon: <DollarOutlined />,
            color: "#52c41a",
        },
        {
            title: "Tổng số lượng tồn kho",
            value: `${(totalQuantity || 0).toLocaleString()} đơn vị`,
            icon: <MedicineBoxOutlined />,
            color: "#faad14",
        },
        {
            title: "Tổng lợi nhuận năm",
            value: (() => {
                if (!monthlyProfitLoss || !monthlyProfitLoss.data) return "0 VND";
                const totalProfit = Object.values(monthlyProfitLoss.data).reduce(
                    (sum, d) => sum + (d.profit || 0),
                    0
                );
                return new Intl.NumberFormat("vi-VN", {
                    style: "currency",
                    currency: "VND",
                }).format(totalProfit);
            })(),
            icon: <TeamOutlined />,
            color: "#1890ff",
        },
    ];

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-6">Báo cáo tổng quan</h1>

            {loading ? (
                <div className="flex justify-center items-center py-20">
                    <Spin size="large" />
                </div>
            ) : (
                <>
                    {/* Export selector + button */}
                    <div className="flex flex-wrap items-center gap-4 mb-6">
                        <Select
                            value={reportType}
                            onChange={(val) => setReportType(val)}
                            options={[
                                { label: "Tồn kho - Giá trị (Excel)", value: "medicine-inventory-value" },
                                { label: "Tồn kho - Số lượng (Excel)", value: "medicine-inventory-quantity" },
                                { label: "Lãi/lỗ theo năm (Excel)", value: "profit-loss-yearly" },
                            ]}
                            style={{ width: 320 }}
                        />

                        {reportType === "profit-loss-yearly" && (
                            <InputNumber
                                min={2000}
                                max={2100}
                                value={exportYear}
                                onChange={(v) => setExportYear(Number(v || new Date().getFullYear()))}
                            />
                        )}

                        <Button
                            type="primary"
                            onClick={async () => {
                                try {
                                    setLoading(true);
                                    if (reportType === "medicine-inventory-value") {
                                        await downloadBlob(`/api/reports/export?type=medicine-inventory-value&format=xlsx`, "medicine_inventory_value.xlsx");
                                        showSuccess("Đã tải về file Excel (Tồn kho - Giá trị)");
                                    } else if (reportType === "medicine-inventory-quantity") {
                                        await downloadBlob(`/api/reports/export?type=medicine-inventory-quantity&format=xlsx`, "medicine_inventory_quantity.xlsx");
                                        showSuccess("Đã tải về file Excel (Tồn kho - Số lượng)");
                                    } else if (reportType === "profit-loss-yearly") {
                                        const startYear = exportYear;
                                        const endYear = exportYear;
                                        await downloadBlob(`/api/reports/export?type=profit-loss-yearly&format=xlsx&startYear=${startYear}&endYear=${endYear}`, "profit_loss_yearly.xlsx");
                                        showSuccess("Đã tải về file Excel (Lãi/lỗ năm)");
                                    }
                                } catch (err: any) {
                                    showError(err?.message || "Xuất Excel thất bại");
                                } finally {
                                    setLoading(false);
                                }
                            }}
                        >
                            Xuất Excel
                        </Button>
                    </div>

                    {/* Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                        {reportData.map((item, index) => (
                            <ReportCard
                                key={index}
                                title={item.title}
                                value={item.value}
                                icon={item.icon}
                                color={item.color}
                            />
                        ))}
                    </div>

                    {/* Biểu đồ */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        {/* Line Chart - Thu Chi */}
                        <Box className="bg-white p-6 shadow rounded-lg">
                            <h2 className="text-lg font-semibold mb-4">
                                Thu - chi theo tháng ({new Date().getFullYear()})
                            </h2>
                            <LineChart
                                width={500}
                                height={300}
                                series={[
                                    {
                                        data: incomeSeries,
                                        label: "Thu nhập",
                                        yAxisId: "leftAxisId",
                                    },
                                    {
                                        data: expenseSeries,
                                        label: "Chi phí",
                                        yAxisId: "rightAxisId",
                                    },
                                ]}
                                xAxis={[{ scaleType: "point", data: xLabels }]}
                                yAxis={[
                                    { id: "leftAxisId", width: 50 },
                                    { id: "rightAxisId", position: "right" },
                                ]}
                            />
                        </Box>

                        {/* Pie Chart - Tồn kho */}
                        <Box className="bg-white p-6 shadow rounded-lg">
                            <h2 className="text-lg font-semibold mb-4">
                                Cơ cấu tồn kho dược phẩm
                            </h2>
                            <PieChart
                                series={[
                                    {
                                        data: stockData,
                                        arcLabel: undefined,
                                        arcLabelMinAngle: 15,
                                        arcLabelRadius: "60%",
                                    },
                                ]}
                                width={400}
                                height={300}
                                sx={{
                                    [`& .${pieArcLabelClasses.root}`]: {
                                        fontWeight: "bold",
                                    },
                                }}
                            />
                        </Box>
                    </div>
                </>
            )}
        </div>
    );
}
