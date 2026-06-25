"use client";

import { useEffect, useState } from "react";
import {
    Table,
    Button,
    Popconfirm,
    message,
    Spin,
    Input,
    Select,
    Space,
    Tag,
    Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useRouter } from "next/navigation";
import { EyeOutlined, DollarOutlined, DeleteOutlined } from "@ant-design/icons";
import { getInvoices, deleteInvoice, Invoice } from "@/lib/services/invoiceService";
import dayjs from "dayjs";

const { Search } = Input;
const { Option } = Select;
const { Text } = Typography;

const getStatusColor = (status: string) => {
    switch (status) {
        case "Paid":
            return "green";
        case "Partial":
            return "orange";
        case "Unpaid":
            return "red";
        default:
            return "default";
    }
};

const getStatusText = (status: string) => {
    switch (status) {
        case "Paid":
            return "Đã thanh toán";
        case "Partial":
            return "Thanh toán một phần";
        case "Unpaid":
            return "Chưa thanh toán";
        default:
            return status;
    }
};

export default function InvoicesPage() {
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [filteredInvoices, setFilteredInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchText, setSearchText] = useState("");
    const [statusFilter, setStatusFilter] = useState<string | null>(null);
    const [role, setRole] = useState<string>("");
    const router = useRouter();

    // TỰ VIẾT
    const fetchInvoices = async () => {
        try {
            setLoading(true);
            const data = await getInvoices(statusFilter ? { status: statusFilter } : undefined);
            setInvoices(data);
            setFilteredInvoices(data);
        } catch (error) {
            console.error("Fetch invoices error:", error);
            message.error("Không thể tải danh sách hóa đơn");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInvoices();
    }, []);

    useEffect(() => {
        const fetchRole = async () => {
            try {
                const res = await fetch("/api/session", { cache: "no-store" });
                const data = await res.json();
                setRole((data?.user?.role || "").toLowerCase());
            } catch {
                setRole("");
            }
        };
        fetchRole();
    }, []);
    // 

    const normalizeText = (str: string) =>
        str
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-zA-Z0-9\s]/g, "")
            .toLowerCase()
            .trim();

    const handleFilter = (text: string, status: string | null) => {
        let filtered = [...invoices];
        const search = normalizeText(text);

        if (search) {
            filtered = filtered.filter((item) => {
                const patientName = typeof item.patient_id === 'object'
                    ? item.patient_id.fullname || ''
                    : '';
                const appointmentDate = typeof item.appointment_id === 'object'
                    ? item.appointment_id.appointment_date || ''
                    : '';
                return (
                    normalizeText(patientName).includes(search) ||
                    normalizeText(item._id).includes(search) ||
                    normalizeText(appointmentDate).includes(search)
                );
            });
        }

        if (status) {
            filtered = filtered.filter((item) => item.status === status);
        }

        setFilteredInvoices(filtered);
    };

    // TỰ VIẾT
    const handleDelete = async (id: string) => {
        try {
            await deleteInvoice(id);
            message.success("Xóa hóa đơn thành công");
            fetchInvoices();
        } catch (error: any) {
            message.error(error.message || "Không thể xóa hóa đơn");
        }
    };
    // 

    const columns: ColumnsType<Invoice> = [
        {
            title: "Mã hóa đơn",
            dataIndex: "_id",
            key: "_id",
            render: (id: string) => <Text copyable={{ text: id }}>{id.slice(-8)}</Text>,
        },
        {
            title: "Bệnh nhân",
            key: "patient",
            render: (_, record) => {
                const patient = typeof record.patient_id === 'object' ? record.patient_id : null;
                return patient?.fullname || "N/A";
            },
        },
        {
            title: "Ngày khám",
            key: "appointment_date",
            render: (_, record) => {
                const appointment = typeof record.appointment_id === 'object' ? record.appointment_id : null;
                return appointment?.appointment_date
                    ? dayjs(appointment.appointment_date).format("DD/MM/YYYY")
                    : "N/A";
            },
        },
        {
            title: "Tổng tiền",
            dataIndex: "total_amount",
            key: "total_amount",
            render: (amount: number) => (
                <Text strong>{amount?.toLocaleString("vi-VN")} đ</Text>
            ),
            sorter: (a, b) => (a.total_amount || 0) - (b.total_amount || 0),
        },
        {
            title: "Trạng thái",
            dataIndex: "status",
            key: "status",
            render: (status: string) => (
                <Tag color={getStatusColor(status)}>{getStatusText(status)}</Tag>
            ),
            filters: [
                { text: "Đã thanh toán", value: "Paid" },
                { text: "Thanh toán một phần", value: "Partial" },
                { text: "Chưa thanh toán", value: "Unpaid" },
            ],
            onFilter: (value, record) => record.status === value,
        },
        {
            title: "Ngày tạo",
            dataIndex: "created_at",
            key: "created_at",
            render: (date: string) => dayjs(date).format("DD/MM/YYYY HH:mm"),
            sorter: (a, b) => dayjs(a.created_at).unix() - dayjs(b.created_at).unix(),
        },
        {
            title: "Thao tác",
            key: "action",
            render: (_, record) => (
                <Space>
                    <Button
                        type="link"
                        icon={<EyeOutlined />}
                        onClick={() => router.push(`/dashboard/invoices/${record._id}`)}
                    >
                        Chi tiết
                    </Button>
                    {role === "admin" && (
                        <Popconfirm
                            title="Xóa hóa đơn"
                            description="Bạn có chắc chắn muốn xóa hóa đơn này?"
                            onConfirm={() => handleDelete(record._id)}
                            okText="Xóa"
                            cancelText="Hủy"
                        >
                            <Button type="link" danger>
                                Xóa
                            </Button>
                        </Popconfirm>
                    )}
                </Space>
            ),
        },
    ];

    // TỰ VIẾT
    return (
        <div style={{ padding: "24px" }}>
            <div style={{ marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Typography.Title level={2}>Quản lý Hóa đơn</Typography.Title>
                {role === "admin" && (
                    <Button
                        icon={<DeleteOutlined />}
                        onClick={() => router.push("/dashboard/invoices/disabled")}
                    >
                        Thùng rác
                    </Button>
                )}
            </div>

            <Space style={{ marginBottom: "16px", width: "100%" }} direction="vertical" size="middle">
                <Space>
                    <Search
                        placeholder="Tìm kiếm theo tên bệnh nhân, mã hóa đơn..."
                        allowClear
                        style={{ width: 300 }}
                        onChange={(e) => {
                            setSearchText(e.target.value);
                            handleFilter(e.target.value, statusFilter);
                        }}
                        value={searchText}
                    />
                    <Select
                        placeholder="Lọc theo trạng thái"
                        allowClear
                        style={{ width: 200 }}
                        onChange={(value) => {
                            setStatusFilter(value);
                            handleFilter(searchText, value);
                        }}
                        value={statusFilter}
                    >
                        <Option value="Unpaid">Chưa thanh toán</Option>
                        <Option value="Partial">Thanh toán một phần</Option>
                        <Option value="Paid">Đã thanh toán</Option>
                    </Select>
                </Space>
            </Space>

            <Table
                columns={columns}
                dataSource={filteredInvoices}
                rowKey="_id"
                loading={loading}
                pagination={{
                    pageSize: 10,
                    showSizeChanger: true,
                    showTotal: (total) => `Tổng ${total} hóa đơn`,
                }}
            />
        </div>
    );
    // 
}

