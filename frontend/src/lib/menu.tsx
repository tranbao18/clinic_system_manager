// TỰ VIẾT
import Link from "next/link";
import {
    DashboardOutlined,
    SolutionOutlined,
    TeamOutlined,
    ScheduleOutlined,
    AreaChartOutlined,
    UserOutlined,
    IdcardOutlined,
    MedicineBoxOutlined,
    DollarOutlined
} from "@ant-design/icons";

export const getMenuByRole = (role: string) => {
    const allMenus = {
        admin: [
            { key: "1", icon: <DashboardOutlined />, label: "Dashboard", href: "/dashboard" },
            { key: "6", icon: <UserOutlined />, label: "Nhân viên", href: "/dashboard/employees" },
            { key: "2", icon: <TeamOutlined />, label: "Bệnh nhân", href: "/dashboard/patients" },
            { key: "4", icon: <ScheduleOutlined />, label: "Lịch hẹn", href: "/dashboard/appointments" },
            { key: "7", icon: <ScheduleOutlined />, label: "Lịch trực", href: "/dashboard/schedules" },
            { key: "8", icon: <MedicineBoxOutlined />, label: "DS Thuốc", href: "/dashboard/medicines" },
            { key: "9", icon: <MedicineBoxOutlined />, label: "DS Nhập thuốc", href: "/dashboard/medicine-imports" },
            { key: "10", icon: <DollarOutlined />, label: "Hoá đơn", href: "/dashboard/invoices" },
            { key: "11", icon: <ScheduleOutlined />, label: "Bảng lương", href: "/dashboard/payroll" },
        ],
        doctor: [
            { key: "1", icon: <IdcardOutlined />, label: "Dashboard", href: "/dashboard" },
            { key: "2", icon: <TeamOutlined />, label: "Bệnh nhân", href: "/dashboard/patients" },
            { key: "3", icon: <ScheduleOutlined />, label: "Lịch hẹn", href: "/dashboard/appointments" },
            { key: "4", icon: <ScheduleOutlined />, label: "Lịch trực", href: "/dashboard/schedules" },
        ],
        nurse: [
            { key: "1", icon: <IdcardOutlined />, label: "Dashboard", href: "/dashboard" },
            { key: "2", icon: <TeamOutlined />, label: "Bệnh nhân", href: "/dashboard/patients" },
            { key: "3", icon: <ScheduleOutlined />, label: "Lịch trực", href: "/dashboard/schedules" },
        ],
        receptionist: [
            { key: "1", icon: <DashboardOutlined />, label: "Dashboard", href: "/dashboard" },
            { key: "2", icon: <TeamOutlined />, label: "Bệnh nhân", href: "/dashboard/patients" },
            { key: "3", icon: <ScheduleOutlined />, label: "Lịch hẹn", href: "/dashboard/appointments" },
            { key: "4", icon: <ScheduleOutlined />, label: "Lịch trực", href: "/dashboard/schedules" },
        ],
        accountant: [
            { key: "1", icon: <IdcardOutlined />, label: "Dashboard", href: "/dashboard" },
            { key: "2", icon: <AreaChartOutlined />, label: "Hoá đơn", href: "/dashboard/invoices" },
            { key: "4", icon: <AreaChartOutlined />, label: "Báo cáo", href: "/dashboard/report" },
            { key: "5", icon: <ScheduleOutlined />, label: "Lịch trực", href: "/dashboard/schedules" },
            { key: "6", icon: <ScheduleOutlined />, label: "Bảng lương", href: "/dashboard/payroll" },
        ],
        pharmacist: [
            { key: "1", icon: <MedicineBoxOutlined />, label: "Dashboard", href: "/dashboard" },
            { key: "2", icon: <MedicineBoxOutlined />, label: "DS Thuốc", href: "/dashboard/medicines" },
            { key: "3", icon: <MedicineBoxOutlined />, label: "DS Nhập thuốc", href: "/dashboard/medicine-imports" },
            { key: "4", icon: <ScheduleOutlined />, label: "Lịch trực", href: "/dashboard/schedules" },
        ],
    };

    if (role === "admin") return allMenus.admin;
    if (role === "doctor") return allMenus.doctor;
    if (role === "nurse") return allMenus.nurse;
    if (role === "receptionist") return allMenus.receptionist;
    if (role === "accountant") return allMenus.accountant;
    if (role === "pharmacist") return allMenus.pharmacist;
    return [];
};
