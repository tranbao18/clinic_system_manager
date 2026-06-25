
"use client";

import { Card, CardContent } from "@/components/ui/card";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { Clock, Calendar, Heart, Sparkles } from "lucide-react";
import UsersService from "@/lib/services/usersService";
import { LineChart, PieChart, pieArcLabelClasses } from "@mui/x-charts";
import { Box } from "@mui/material";
import { Spin, message } from "antd";

const data = [
    { name: "5k", uv: 30 },
    { name: "10k", uv: 45 },
    { name: "15k", uv: 35 },
    { name: "20k", uv: 65 },
    { name: "25k", uv: 50 },
    { name: "30k", uv: 40 },
    { name: "35k", uv: 55 },
    { name: "40k", uv: 20 },
    { name: "45k", uv: 60 },
    { name: "50k", uv: 55 },
    { name: "55k", uv: 52 },
    { name: "60k", uv: 48 },
];

const fallbackQuotes = [
    {
        text: "Mỗi ngày là cơ hội mới để làm cho cuộc sống tốt đẹp hơn.",
        author: "Khuyết danh",
    },
    {
        text: "Sức khỏe là tài sản quý giá nhất của con người.",
        author: "Khuyết danh",
    },
    {
        text: "Hãy sống như thể ngày mai là ngày cuối cùng của bạn.",
        author: "Steve Jobs",
    },
    {
        text: "Thành công không phải là đích đến, mà là hành trình.",
        author: "Khuyết danh",
    },
    {
        text: "Hãy làm những gì bạn yêu thích và yêu thích những gì bạn làm.",
        author: "Khuyết danh",
    },
    {
        text: "Đừng sợ thất bại, hãy sợ việc không dám thử.",
        author: "Khuyết danh",
    },
    {
        text: "Mỗi bác sĩ tốt đều biết rằng lòng nhân ái là liều thuốc tốt nhất.",
        author: "Khuyết danh",
    },
    {
        text: "Sự kiên nhẫn và chăm chỉ sẽ luôn được đền đáp xứng đáng.",
        author: "Khuyết danh",
    },
    {
        text: "Hãy luôn mỉm cười, vì nụ cười là liều thuốc tốt nhất cho tâm hồn.",
        author: "Khuyết danh",
    },
    {
        text: "Thành công bắt đầu từ việc quyết định thử.",
        author: "Khuyết danh",
    },
    {
        text: "Hãy sống tích cực và lan tỏa năng lượng tích cực đến mọi người.",
        author: "Khuyết danh",
    },
    {
        text: "Mỗi bệnh nhân là một cơ hội để chúng ta thể hiện sự chăm sóc và tình yêu thương.",
        author: "Khuyết danh",
    },
    {
        text: "Đừng bao giờ từ bỏ ước mơ của bạn, hãy kiên trì và nỗ lực hết mình.",
        author: "Khuyết danh",
    },
    {
        text: "Sự tử tế không tốn kém gì nhưng lại có giá trị vô cùng lớn.",
        author: "Khuyết danh",
    },
    {
        text: "Hãy luôn học hỏi và cải thiện bản thân mỗi ngày.",
        author: "Khuyết danh",
    },
    {
        text: "Thời gian là tài sản quý giá nhất, hãy sử dụng nó một cách khôn ngoan.",
        author: "Khuyết danh",
    },
    {
        text: "Mỗi ngày mới là một cơ hội để bắt đầu lại và làm tốt hơn.",
        author: "Khuyết danh",
    },
    {
        text: "Hãy tin vào bản thân và khả năng của chính mình.",
        author: "Khuyết danh",
    },
    {
        text: "Sự chăm sóc và quan tâm đến người khác là dấu hiệu của một tâm hồn đẹp.",
        author: "Khuyết danh",
    },
    {
        text: "Hãy sống với đam mê và làm việc với tất cả tâm huyết.",
        author: "Khuyết danh",
    },
];

const getRandomFallbackQuote = () => {
    const randomIndex = Math.floor(Math.random() * fallbackQuotes.length);
    return fallbackQuotes[randomIndex];
};

const roleNames: { [key: string]: string } = {
    doctor: "Bác sĩ",
    nurse: "Y tá",
    pharmacist: "Dược sĩ",
    receptionist: "Lễ tân",
    accountant: "Kế toán",
    admin: "Quản trị viên",
};

interface Quote {
    text: string;
    author: string;
}

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

export default function Dashboard() {
    const [role, setRole] = useState<string>("");
    const [employeeName, setEmployeeName] = useState<string>("");
    const [loading, setLoading] = useState(true);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [currentQuote, setCurrentQuote] = useState<Quote>(getRandomFallbackQuote());
    const [reportLoading, setReportLoading] = useState(false);
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [totalQuantity, setTotalQuantity] = useState<number>(0);
    const [totalValue, setTotalValue] = useState<number>(0);
    const [monthlyProfitLoss, setMonthlyProfitLoss] =
        useState<ProfitLossMonthlyResponse | null>(null);
    const [lastQuoteFetch, setLastQuoteFetch] = useState<number>(0);

    useEffect(() => {
        const fetchUserData = async () => {
            try {
                // Get user data from sessionStorage instead of API to maintain per-tab sessions
                const userData = sessionStorage.getItem("user") || localStorage.getItem("user");
                if (!userData) {
                    throw new Error("Chưa đăng nhập");
                }

                const me = JSON.parse(userData);
                const userRole = (me?.role || "").toLowerCase();
                setRole(userRole);

                const userId = me.id || me._id;
                if (userId) {
                    try {
                        console.log("Fetching employee data for userId:", userId);
                        const userData = await UsersService.getByUserId(userId);
                        console.log("User data received:", userData);

                        if (userData?.employee?.fullname) {
                            setEmployeeName(userData.employee.fullname);
                            console.log("Employee name set to:", userData.employee.fullname);
                        } else if (me?.username) {
                            setEmployeeName(me.username);
                            console.log("Using username as fallback:", me.username);
                        }
                    } catch (err) {
                        console.error("Error fetching employee data:", err);
                        if (me?.username) {
                            setEmployeeName(me.username);
                        }
                    }
                } else if (me?.username) {
                    setEmployeeName(me.username);
                }
            } catch (err) {
                console.error("Error fetching user data:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchUserData();
    }, []);

    // TỰ VIẾT
    const fetchQuote = async (retryCount = 0) => {
        // Check if we fetched a quote recently (within last 4 minutes) to avoid unnecessary API calls
        const now = Date.now();
        if (now - lastQuoteFetch < 240000) { // 4 minutes in milliseconds
            console.log("Skipping quote fetch - recently fetched, using current quote");
            return;
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

            const response = await fetch("/api/quotes/random", {
                cache: "no-store",
                signal: controller.signal,
            });

            clearTimeout(timeoutId);
            console.log("Quote API response status:", response.status);

            // Handle rate limiting (429) with exponential backoff
            if (response.status === 429) {
                if (retryCount < 3) { // Max 3 retries
                    const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff: 1s, 2s, 4s
                    console.log(`Rate limited (429), retrying in ${delay}ms (attempt ${retryCount + 1}/3)`);
                    setTimeout(() => fetchQuote(retryCount + 1), delay);
                    return;
                } else {
                    console.log("Max retries reached for rate limited quote API, using fallback");
                    setCurrentQuote(getRandomFallbackQuote());
                    return;
                }
            }

            if (response.ok) {
                const data = await response.json();
                console.log("Quote data received from API:", data);

                if (data.error) {
                    throw new Error(data.error);
                }

                if (data.text && data.author) {
                    setCurrentQuote({
                        text: data.text,
                        author: data.author,
                    });
                    setLastQuoteFetch(Date.now()); // Update last fetch timestamp
                    return; // Thành công, không cần fallback
                } else {
                    throw new Error("Invalid API response format");
                }
            } else {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `API returned status ${response.status}`);
            }
        } catch (error) {
            console.error("Error fetching quote from API:", error);
            console.log("Using fallback quote from local array");
            setCurrentQuote(getRandomFallbackQuote());
        }
    };
    //

    // TỰ VIẾT
    useEffect(() => {
        if (!loading && role !== "admin") {
            fetchQuote();
            const quoteTimer = setInterval(() => {
                fetchQuote();
            }, 300000); // Update every 5 minutes (300,000ms) to avoid rate limiting

            return () => clearInterval(quoteTimer);
        }
    }, [loading, role]);
    //

    // TỰ VIẾT
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);

        return () => clearInterval(timer);
    }, []);
    //

    useEffect(() => {
        const fetchReportData = async () => {
            if (role !== "admin") return;
            try {
                setReportLoading(true);

                const now = new Date();
                const year = now.getFullYear();
                const startDate = `${year}-01-01`;
                const endDate = `${year}-12-31`;

                const [invRes, qtyRes, valRes, plRes] = await Promise.all([
                    fetch("/api/reports/medicine/inventory"),
                    fetch("/api/reports/medicine/inventory/quantity"),
                    fetch("/api/reports/medicine/inventory/value"),
                    fetch(
                        `/api/reports/profit-loss/monthly?startDate=${startDate}&endDate=${endDate}`
                    ),
                ]);

                const invData = await invRes.json();
                const qtyData = await qtyRes.json();
                const valData = await valRes.json();
                const plData = await plRes.json();

                if (!invRes.ok) throw new Error(invData.error || "Không thể lấy tồn kho thuốc");
                if (!qtyRes.ok)
                    throw new Error(qtyData.error || "Không thể lấy tổng số lượng tồn kho");
                if (!valRes.ok)
                    throw new Error(valData.error || "Không thể lấy tổng giá trị tồn kho");
                if (!plRes.ok)
                    throw new Error(plData.error || "Không thể lấy báo cáo lãi/lỗ theo tháng");

                setInventory(invData.data || []);
                setTotalQuantity(qtyData.total_quantity || 0);
                setTotalValue(valData.total_value || 0);
                setMonthlyProfitLoss(plData);
            } catch (err: any) {
                console.error("Fetch dashboard report error:", err);
                message.error(err.message || "Không thể tải dữ liệu báo cáo");
            } finally {
                setReportLoading(false);
            }
        };

        fetchReportData();
    }, [role]);

    const formatDate = (date: Date) => {
        const days = [
            "Chủ Nhật",
            "Thứ Hai",
            "Thứ Ba",
            "Thứ Tư",
            "Thứ Năm",
            "Thứ Sáu",
            "Thứ Bảy",
        ];
        const months = [
            "Tháng 1",
            "Tháng 2",
            "Tháng 3",
            "Tháng 4",
            "Tháng 5",
            "Tháng 6",
            "Tháng 7",
            "Tháng 8",
            "Tháng 9",
            "Tháng 10",
            "Tháng 11",
            "Tháng 12",
        ];

        const day = days[date.getDay()];
        const dayNum = date.getDate();
        const month = months[date.getMonth()];
        const year = date.getFullYear();

        return `${day}, ${dayNum} ${month} ${year}`;
    };

    const formatTime = (date: Date) => {
        const hours = date.getHours().toString().padStart(2, "0");
        const minutes = date.getMinutes().toString().padStart(2, "0");
        const seconds = date.getSeconds().toString().padStart(2, "0");
        return `${hours}:${minutes}:${seconds}`;
    };

    const getGreeting = () => {
        const hour = currentTime.getHours();
        if (hour < 12) return "Chào buổi sáng";
        if (hour < 18) return "Chào buổi chiều";
        return "Chào buổi tối";
    };

    const { xLabels, incomeSeries, expenseSeries } = useMemo(() => {
        if (!monthlyProfitLoss || !monthlyProfitLoss.data) {
            return { xLabels: [], incomeSeries: [], expenseSeries: [] };
        }
        const keys = Object.keys(monthlyProfitLoss.data).sort(); // YYYY-MM
        const incomeSeries = keys.map((k) => monthlyProfitLoss.data[k].income || 0);
        const expenseSeries = keys.map((k) => {
            const d = monthlyProfitLoss.data[k];
            return (d.medicineCost || 0) + (d.payrollCost || 0);
        });
        const xLabels = keys.map((k) => `Th${Number(k.slice(5, 7))}`);
        return { xLabels, incomeSeries, expenseSeries };
    }, [monthlyProfitLoss]);

    const stockData = useMemo(() => {
        if (!inventory || inventory.length === 0) return [];
        const sorted = [...inventory].sort((a, b) => b.total_remaining - a.total_remaining);
        const top = sorted.slice(0, 5);
        const others = sorted.slice(5);
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
        return data;
    }, [inventory]);

    const totalProfitYear = useMemo(() => {
        if (!monthlyProfitLoss || !monthlyProfitLoss.data) return 0;
        return Object.values(monthlyProfitLoss.data).reduce(
            (sum, d) => sum + (d.profit || 0),
            0
        );
    }, [monthlyProfitLoss]);

    if (loading) {
        return (
            <div className="flex h-screen bg-gray-50 items-center justify-center">
                <div className="text-gray-500">Đang tải...</div>
            </div>
        );
    }

    const isAdmin = role === "admin";

    return (
        <div className="flex h-screen bg-gray-50">
            <div className="flex-1 flex flex-col">
                <main className="flex-1 p-6 overflow-y-auto space-y-6">
                    {isAdmin ? (
                        reportLoading ? (
                            <div className="flex justify-center py-10">
                                <Spin />
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {/* Top stats */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <Card>
                                        <CardContent className="p-4">
                                            <h2 className="text-sm text-gray-500">Tổng giá trị tồn kho</h2>
                                            <p className="text-2xl font-bold text-blue-600">
                                                {new Intl.NumberFormat("vi-VN", {
                                                    style: "currency",
                                                    currency: "VND",
                                                }).format(totalValue || 0)}
                                            </p>
                                        </CardContent>
                                    </Card>
                                    <Card>
                                        <CardContent className="p-4">
                                            <h2 className="text-sm text-gray-500">Tổng số lượng tồn kho</h2>
                                            <p className="text-2xl font-bold text-amber-600">
                                                {(totalQuantity || 0).toLocaleString()} đơn vị
                                            </p>
                                        </CardContent>
                                    </Card>
                                    <Card>
                                        <CardContent className="p-4">
                                            <h2 className="text-sm text-gray-500">Tổng lợi nhuận năm</h2>
                                            <p className="text-2xl font-bold text-green-600">
                                                {new Intl.NumberFormat("vi-VN", {
                                                    style: "currency",
                                                    currency: "VND",
                                                }).format(totalProfitYear || 0)}
                                            </p>
                                        </CardContent>
                                    </Card>
                                </div>

                                {/* Charts */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <Box className="bg-white p-6 shadow rounded-lg">
                                        <h2 className="text-lg font-semibold mb-4">
                                            Thu - chi theo tháng ({new Date().getFullYear()})
                                        </h2>
                                        <LineChart
                                            width={500}
                                            height={280}
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

                                    <Box className="bg-white p-6 shadow rounded-lg">
                                        <h2 className="text-lg font-semibold mb-4">Cơ cấu tồn kho dược phẩm</h2>
                                        <PieChart
                                            series={[
                                                {
                                                    data: stockData,
                                                    arcLabel: undefined,
                                                    arcLabelMinAngle: 15,
                                                    arcLabelRadius: "60%",
                                                },
                                            ]}
                                            width={420}
                                            height={280}
                                            sx={{
                                                [`& .${pieArcLabelClasses.root}`]: {
                                                    fontWeight: "bold",
                                                },
                                            }}
                                        />
                                    </Box>
                                </div>
                            </div>
                        )
                    ) : (
                        <div className="space-y-6">
                            {/* Welcome Card */}
                            <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
                                <CardContent className="p-8">
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className="p-3 bg-blue-100 rounded-full">
                                            <Heart className="w-8 h-8 text-blue-600" />
                                        </div>
                                        <div>
                                            <h1 className="text-3xl font-bold text-gray-800">
                                                {getGreeting()}, {employeeName || "bạn"}!
                                            </h1>
                                            <p className="text-lg text-gray-600">
                                                {roleNames[role] || "Nhân viên"}
                                            </p>
                                        </div>
                                    </div>
                                    <p className="text-gray-700 text-lg">
                                        Chúc bạn có một ngày làm việc hiệu quả và tràn đầy năng lượng!
                                    </p>
                                </CardContent>
                            </Card>

                            {/* Date and Time Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Card>
                                    <CardContent className="p-6">
                                        <div className="flex items-center gap-3 mb-4">
                                            <Calendar className="w-6 h-6 text-blue-600" />
                                            <h2 className="text-xl font-semibold text-gray-700">Ngày</h2>
                                        </div>
                                        <p className="text-2xl font-bold text-gray-800">
                                            {formatDate(currentTime)}
                                        </p>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardContent className="p-6">
                                        <div className="flex items-center gap-3 mb-4">
                                            <Clock className="w-6 h-6 text-green-600" />
                                            <h2 className="text-xl font-semibold text-gray-700">Giờ</h2>
                                        </div>
                                        <p className="text-3xl font-bold text-gray-800 font-mono">
                                            {formatTime(currentTime)}
                                        </p>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Quote Card */}
                            <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
                                <CardContent className="p-8">
                                    <div className="flex items-start gap-4">
                                        <div className="p-3 bg-purple-100 rounded-full mt-1">
                                            <Sparkles className="w-6 h-6 text-purple-600" />
                                        </div>
                                        <div className="flex-1">
                                            <h2 className="text-xl font-semibold text-gray-700 mb-4">
                                                Câu nói truyền cảm hứng
                                            </h2>
                                            <blockquote className="text-lg text-gray-800 italic mb-4 leading-relaxed">
                                                "{currentQuote.text}"
                                            </blockquote>
                                            <p className="text-sm text-gray-600 text-right">
                                                — {currentQuote.author}
                                            </p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}
