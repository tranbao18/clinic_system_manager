"use client";

import { useEffect, useState } from "react";
import {
    Table,
    Button,
    Popconfirm,
    message,
    Spin,
    Input,
    Space,
    Tag,
    Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useRouter } from "next/navigation";
import { getDisabledInvoices, restoreInvoice, deleteInvoice, Invoice } from "@/lib/services/invoiceService";
import { UndoOutlined, ArrowLeftOutlined } from "@ant-design/icons";
import dayjs from "dayjs";

const { Search } = Input;
const { Text } = Typography;

export default function DisabledInvoicesPage() {
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [filteredInvoices, setFilteredInvoices] = useState<Invoice[]>([]);
    const [deletingInvoiceId, setDeletingInvoiceId] = useState<string | null>(null);
    const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
    const [bulkDeleting, setBulkDeleting] = useState(false);
    const [loading, setLoading] = useState(true);
    const [searchText, setSearchText] = useState("");
    const router = useRouter();

    const fetchInvoices = async () => {
        try {
            setLoading(true);
            const data = await getDisabledInvoices();
            setInvoices(data);
            setFilteredInvoices(data);
        } catch (error) {
            console.error("Fetch disabled invoices error:", error);
            message.error("Không thể tải danh sách hóa đơn đã xóa");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInvoices();
    }, []);

    const normalizeText = (str: string) =>
        str
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-zA-Z0-9\s]/g, "")
            .toLowerCase()
            .trim();

    const onSearch = (value: string) => {
        setSearchText(value);
        const search = normalizeText(value);

        if (!search) {
            setFilteredInvoices(invoices);
        } else {
            const filtered = invoices.filter((item) => {
                const patientName = typeof item.patient_id === 'object' ? (item.patient_id.fullname || '') : '';
                return (
                    normalizeText(patientName).includes(search) ||
                    normalizeText(item._id).includes(search)
                );
            });
            setFilteredInvoices(filtered);
        }
    };

    // TỰ VIẾT
    const handleRestore = async (id: string) => {
        try {
            await restoreInvoice(id);
            message.success("Đã khôi phục hóa đơn");
            fetchInvoices();
        } catch (err: any) {
            console.error("Restore invoice failed:", err);
            message.error(err.message || "Khôi phục thất bại");
        }
    };

    const handlePermanentDelete = async (id: string) => {
        try {
            setDeletingInvoiceId(id);
            await deleteInvoice(id, true);
            message.success("Đã xóa vĩnh viễn hóa đơn");
            fetchInvoices();
        } catch (err: any) {
            console.error("Permanent delete invoice failed:", err);
            message.error(err.message || "Xóa vĩnh viễn thất bại");
        } finally {
            setDeletingInvoiceId(null);
        }
    };
    // 

    const handleBulkPermanentDelete = async () => {
        if (!selectedRowKeys || selectedRowKeys.length === 0) return;
        const ids = selectedRowKeys.map(k => String(k));
        try {
            setBulkDeleting(true);
            const results = await Promise.allSettled(ids.map(id => deleteInvoice(id, true)));
            const successCount = results.filter(r => r.status === "fulfilled").length;
            const failCount = results.length - successCount;
            if (successCount > 0) {
                message.success(`Đã xóa vĩnh viễn ${successCount} hóa đơn`);
            }
            if (failCount > 0) {
                message.error(`${failCount} hóa đơn xóa thất bại`);
            }
            setSelectedRowKeys([]);
            fetchInvoices();
        } catch (err: any) {
            console.error("Bulk delete invoices failed:", err);
            message.error(err.message || "Xóa hàng loạt thất bại");
        } finally {
            setBulkDeleting(false);
        }
    };

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
            title: "Tổng tiền",
            dataIndex: "total_amount",
            key: "total_amount",
            render: (amount: number) => (
                <Text strong>{amount?.toLocaleString("vi-VN")} đ</Text>
            ),
            sorter: (a, b) => (a.total_amount || 0) - (b.total_amount || 0),
        },
        {
            title: "Ngày tạo",
            dataIndex: "created_at",
            key: "created_at",
            render: (date: string) => dayjs(date).format("DD/MM/YYYY HH:mm"),
            sorter: (a, b) => dayjs(a.created_at).unix() - dayjs(b.created_at).unix(),
        },
        {
            title: "Trạng thái",
            key: "status",
            render: () => (
                <Tag color="red">Đã xóa</Tag>
            ),
        },
        {
            title: "Hành động",
            key: "action",
            render: (_, record) => (
                <div className="flex gap-2">
                    <Popconfirm
                        title="Bạn có chắc chắn muốn khôi phục?"
                        onConfirm={() => handleRestore(record._id)}
                        okText="Khôi phục"
                        cancelText="Hủy"
                    >
                        <Button type="primary" icon={<UndoOutlined />}>
                            Khôi phục
                        </Button>
                    </Popconfirm>
                    <Popconfirm
                        title="Xóa vĩnh viễn sẽ không thể khôi phục. Tiếp tục?"
                        onConfirm={() => handlePermanentDelete(record._id)}
                        okText="Xóa vĩnh viễn"
                        cancelText="Hủy"
                    >
                        <Button
                            danger
                            loading={deletingInvoiceId === record._id}
                        >
                            Xóa vĩnh viễn
                        </Button>
                    </Popconfirm>
                </div>
            ),
        },
    ];
    // TỰ VIẾT
    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-4">
                <div>
                    <Button
                        icon={<ArrowLeftOutlined />}
                        onClick={() => router.push("/dashboard/invoices")}
                        className="mb-2"
                    >
                        Quay lại
                    </Button>
                    <h1 className="text-2xl font-bold">Danh sách hóa đơn đã xóa</h1>

                </div>
            </div>

            <Space className="mb-4 flex flex-wrap" align="center">
                <Search
                    placeholder="Nhập mã hóa đơn hoặc tên bệnh nhân..."
                    allowClear
                    enterButton="Tìm kiếm"
                    onSearch={onSearch}
                    style={{ width: 300 }}
                />
                <div className="ml-4">
                    <Popconfirm
                        title={() => `Bạn có chắc chắn muốn xóa vĩnh viễn ${selectedRowKeys.length} hóa đơn đã chọn?`}
                        onConfirm={handleBulkPermanentDelete}
                        okText="Xóa vĩnh viễn"
                        cancelText="Hủy"
                        okButtonProps={{ loading: bulkDeleting }}
                    >
                        <Button
                            danger
                            disabled={selectedRowKeys.length === 0}
                        >
                            Xóa vĩnh viễn (hàng loạt)
                        </Button>
                    </Popconfirm>
                </div>
            </Space>

            {loading ? (
                <div className="flex justify-center items-center py-10">
                    <Spin size="large" />
                </div>
            ) : (
                <Table
                    rowKey="_id"
                    rowSelection={{
                        selectedRowKeys,
                        onChange: (keys) => setSelectedRowKeys(keys as string[]),
                        getCheckboxProps: (record) => ({
                            disabled: bulkDeleting || deletingInvoiceId === record._id,
                        }),
                    }}
                    columns={columns}
                    dataSource={filteredInvoices}
                    pagination={{ pageSize: 8 }}
                    bordered
                />
            )}
        </div>
    );
    // 
}


