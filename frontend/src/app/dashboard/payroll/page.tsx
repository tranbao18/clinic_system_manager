"use client";

import { useEffect, useState } from "react";
import {
    Layout,
    Table,
    Button,
    Input,
    Spin,
    message,
    Tag,
    Space,
    Popconfirm,
    Modal,
    Upload,
    Typography,
    Alert,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import type { TableRowSelection } from "antd/es/table/interface";
import type { UploadFile } from "antd";
import { useRouter } from "next/navigation";
import PayrollService, { Payroll } from "@/lib/services/payrollService";
import { EditOutlined, DeleteOutlined, PlusOutlined, MailOutlined, SendOutlined, FileExcelOutlined, UploadOutlined } from "@ant-design/icons";

const { Text } = Typography;

const { Content } = Layout;
const { Search } = Input;

interface PayrollTableItem extends Payroll {
    key: string;
    employeeName: string;
    employeeEmail: string;
}

export default function PayrollPage() {
    const [payrolls, setPayrolls] = useState<PayrollTableItem[]>([]);
    const [filteredPayrolls, setFilteredPayrolls] = useState<PayrollTableItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
    const [sendingEmail, setSendingEmail] = useState(false);
    const [sendingEmailIds, setSendingEmailIds] = useState<Set<string>>(new Set());
    const [importModalVisible, setImportModalVisible] = useState(false);
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState<{
        success: number;
        failed: number;
        skipped?: number;
        errors: Array<{ row: number; name: string; error: string; type?: string }>;
    } | null>(null);
    const [fileList, setFileList] = useState<UploadFile[]>([]);
    const [role, setRole] = useState<string>("");
    const router = useRouter();

    // TỰ VIÊTS
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

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("vi-VN").format(amount || 0);
    };

    const formatDate = (dateString: string) => {
        if (!dateString) return "-";
        const date = new Date(dateString);
        return date.toLocaleDateString("vi-VN");
    };
    // 

    const fetchPayrolls = async () => {
        try {
            setLoading(true);
            const data = await PayrollService.getAll();

            const payrollsWithEmployee = await Promise.all(
                data.map(async (p: Payroll) => {
                    let employeeName = "N/A";
                    let employeeEmail = "N/A";

                    if (typeof p.employee_id === "object" && p.employee_id) {
                        employeeName = p.employee_id.fullname || "N/A";
                        employeeEmail = p.employee_id.email || "N/A";
                    } else if (typeof p.employee_id === "string") {
                        try {
                            const empRes = await fetch(`/api/employees/${p.employee_id}`, {
                                cache: "no-store",
                            });
                            if (empRes.ok) {
                                const emp = await empRes.json();
                                employeeName = emp.fullname || "N/A";
                                employeeEmail = emp.email || "N/A";
                            }
                        } catch (err) {
                            console.error("Error fetching employee:", err);
                        }
                    }

                    return {
                        ...p,
                        key: p._id,
                        employeeName,
                        employeeEmail,
                        emailSent: p.emailSent ?? false,
                    };
                })
            );

            const activePayrolls = payrollsWithEmployee.filter((p) => !p.disabled);
            setPayrolls(activePayrolls);
            setFilteredPayrolls(activePayrolls);
        } catch (error: any) {
            message.error("Không thể tải danh sách bảng lương: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPayrolls();
    }, []);

    useEffect(() => {
        const visibleKeys = filteredPayrolls.map((p) => p._id);
        setSelectedRowKeys((prevKeys) => {
            const validSelectedKeys = prevKeys.filter((key) =>
                visibleKeys.includes(String(key))
            );
            return validSelectedKeys.length !== prevKeys.length
                ? validSelectedKeys
                : prevKeys;
        });
    }, [filteredPayrolls]);

    // TỰ VIẾT
    const onSearch = (value: string) => {
        if (!value.trim()) {
            setFilteredPayrolls(payrolls);
        } else {
            const searchValue = value.toLowerCase();
            const filtered = payrolls.filter(
                (p) =>
                    p.employeeName.toLowerCase().includes(searchValue) ||
                    p.employeeEmail.toLowerCase().includes(searchValue)
            );
            setFilteredPayrolls(filtered);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await PayrollService.delete(id);
            message.success("Xóa bảng lương thành công");
            fetchPayrolls();
        } catch (error: any) {
            message.error("Lỗi khi xóa bảng lương: " + error.message);
        }
    };
    // 

    const handleSendEmail = async (employeeId: string) => {
        const employeeIdStr = String(employeeId);

        setSendingEmailIds((prev) => new Set(prev).add(employeeIdStr));

        try {
            const result = await PayrollService.sendPayrollToEmployee(employeeId);

            message.success(
                result.message || "Đã gửi email bảng lương thành công",
                3
            );

            await fetchPayrolls();
        } catch (error: any) {
            console.error("Error sending email:", error);
            message.error("Lỗi khi gửi email: " + (error.message || "Không xác định"), 5);
        } finally {
            setSendingEmailIds((prev) => {
                const newSet = new Set(prev);
                newSet.delete(employeeIdStr);
                return newSet;
            });
        }
    };

    const handleSendBulkEmail = async () => {
        if (selectedRowKeys.length === 0) {
            message.warning("Vui lòng chọn ít nhất một nhân viên để gửi email");
            return;
        }

        try {
            setSendingEmail(true);

            const selectedPayrolls = filteredPayrolls.filter((p) =>
                selectedRowKeys.includes(p._id)
            );

            const employeeIds = selectedPayrolls
                .map((p) => {
                    if (typeof p.employee_id === "string") {
                        return p.employee_id;
                    }
                    return p.employee_id._id;
                })
                .filter((id) => id); // Loại bỏ các giá trị null/undefined

            const result = await PayrollService.sendPayrollBulk(employeeIds);

            if (result.results && Array.isArray(result.results)) {
                const successResults = result.results.filter(
                    (r: any) => r.status === "success"
                );
                const failedResults = result.results.filter(
                    (r: any) => r.status === "failed"
                );
                const successCount = successResults.length;
                const failCount = failedResults.length;

                await fetchPayrolls();

                if (failCount === 0) {
                    message.success(
                        `Đã gửi email thành công cho ${successCount} nhân viên`,
                        3
                    );
                } else {
                    message.warning(
                        `Đã gửi email thành công cho ${successCount} nhân viên, thất bại ${failCount} nhân viên`,
                        5
                    );

                    failedResults.forEach((r: any) => {
                        console.error(`Lỗi gửi email cho ${r.employeeId}:`, r.message);
                    });
                }
            } else {
                await fetchPayrolls();
                message.success("Đã gửi email cho các nhân viên đã chọn", 3);
            }

            setSelectedRowKeys([]);
        } catch (error: any) {
            console.error("Error sending bulk email:", error);
            message.error(
                "Lỗi khi gửi email hàng loạt: " + (error.message || "Không xác định"),
                5
            );
        } finally {
            setSendingEmail(false);
        }
    };

    const handleImport = async () => {
        if (fileList.length === 0) {
            message.warning("Vui lòng chọn file để import");
            return;
        }

        const fileItem = fileList[0];
        const file = fileItem?.originFileObj || fileItem;

        if (!file || !(file instanceof File)) {
            message.warning("File không hợp lệ. Vui lòng chọn lại file.");
            return;
        }

        setImporting(true);
        setImportResult(null);

        try {
            const formData = new FormData();
            formData.append("file", file);

            const res = await fetch("/api/payrolls/import", {
                method: "POST",
                body: formData,
            });

            let data;
            try {
                const text = await res.text();
                data = text ? JSON.parse(text) : {};
            } catch (parseError) {
                console.error("Parse JSON error:", parseError);
                throw new Error("Không thể đọc phản hồi từ server");
            }

            const skipped = data.skipped || 0;
            const success = data.success || 0;
            const failed = data.failed || 0;

            if (!res.ok) {
                const errorMsg = data.error || data.message || "Không thể import file";
                setImportResult({
                    success,
                    failed,
                    skipped,
                    errors: data.errors || [],
                });
                message.error(errorMsg);
                return;
            }

            setImportResult({
                success,
                failed,
                skipped,
                errors: data.errors || [],
            });

            if (success > 0) {
                message.success(
                    `Import thành công ${success} bảng lương` +
                    (failed > 0 ? `, ${failed} thất bại` : "") +
                    (skipped > 0 ? `, ${skipped} bị bỏ qua (đã có bảng lương trong tháng đó)` : "")
                );
                fetchPayrolls(); // Refresh danh sách
            } else if (failed > 0) {
                message.warning(`Import thất bại: ${failed} bảng lương không thể import`);
            } else {
                message.warning("Không có bảng lương nào được import thành công");
            }
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : "Lỗi khi import file";
            console.error("Import error:", error);
            message.error(errorMessage);
            setImportResult({
                success: 0,
                failed: 0,
                skipped: 0,
                errors: [{ row: 0, name: "", error: errorMessage }],
            });
        } finally {
            setImporting(false);
        }
    };

    const handleImportModalClose = () => {
        setImportModalVisible(false);
        setFileList([]);
        setImportResult(null);
    };

    const rowSelection: TableRowSelection<PayrollTableItem> = {
        selectedRowKeys,
        onChange: (newSelectedRowKeys: React.Key[]) => {
            setSelectedRowKeys(newSelectedRowKeys);
        },
        getCheckboxProps: (record) => ({
            disabled: record.employeeEmail === "N/A" || !record.employeeEmail,
            name: record.employeeName,
        }),
    };

    const columns: ColumnsType<PayrollTableItem> = [
        {
            title: "Nhân viên",
            dataIndex: "employeeName",
            key: "employeeName",
            sorter: (a, b) => a.employeeName.localeCompare(b.employeeName),
        },
        {
            title: "Email",
            dataIndex: "employeeEmail",
            key: "employeeEmail",
        },
        {
            title: "Lương cơ bản",
            dataIndex: "basic_salary",
            key: "basic_salary",
            render: (value: number) => `${formatCurrency(value)} đ`,
            sorter: (a, b) => (a.basic_salary || 0) - (b.basic_salary || 0),
        },
        {
            title: "Thực nhận",
            dataIndex: "net_salary",
            key: "net_salary",
            render: (value: number) => (
                <strong style={{ color: "#2563eb" }}>
                    {formatCurrency(value)} đ
                </strong>
            ),
            sorter: (a, b) => (a.net_salary || 0) - (b.net_salary || 0),
        },
        {
            title: "Ngày thanh toán",
            dataIndex: "paydate",
            key: "paydate",
            render: (value: string) => formatDate(value),
            sorter: (a, b) =>
                new Date(a.paydate).getTime() - new Date(b.paydate).getTime(),
        },
        {
            title: "Email đã gửi",
            dataIndex: "emailSent",
            key: "emailSent",
            render: (value: boolean) =>
                value ? (
                    <Tag color="green">Đã gửi</Tag>
                ) : (
                    <Tag color="default">Chưa gửi</Tag>
                ),
        },
        {
            title: "Thao tác",
            key: "action",
            render: (_, record) => {
                const employeeId = typeof record.employee_id === "string"
                    ? record.employee_id
                    : record.employee_id._id;
                const employeeIdStr = String(employeeId);
                const isSending = sendingEmailIds.has(employeeIdStr);
                const canEdit = role === "admin" || role === "accountant";
                const canDelete = role === "admin";

                return (
                    <Space size="middle">
                        {canEdit && (
                            <Button
                                type="link"
                                icon={<EditOutlined />}
                                onClick={() => router.push(`/dashboard/payroll/${record._id}`)}
                            >
                                Sửa
                            </Button>
                        )}
                        <Button
                            type="link"
                            icon={<MailOutlined />}
                            onClick={() => handleSendEmail(employeeId)}
                            loading={isSending}
                            disabled={isSending}
                        >
                            Gửi email
                        </Button>
                        {canDelete && (
                            <Popconfirm
                                title="Xóa bảng lương này?"
                                onConfirm={() => handleDelete(record._id)}
                                okText="Xóa"
                                cancelText="Hủy"
                            >
                                <Button
                                    type="link"
                                    danger
                                    icon={<DeleteOutlined />}
                                >
                                    Xóa
                                </Button>
                            </Popconfirm>
                        )}
                    </Space>
                );
            },
        },
    ];

    return (
        <Layout style={{ minHeight: "100vh" }}>
            <Content className="m-4 p-4 bg-white rounded shadow">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-3xl font-bold">Quản lý Bảng lương</h2>
                    <Space>
                        <Search
                            placeholder="Tìm kiếm theo tên hoặc email nhân viên"
                            onSearch={onSearch}
                            style={{ width: 300 }}
                            allowClear
                        />
                        {selectedRowKeys.length > 0 && (
                            <Button
                                type="primary"
                                icon={<SendOutlined />}
                                onClick={handleSendBulkEmail}
                                loading={sendingEmail}
                                style={{ backgroundColor: "#52c41a", borderColor: "#52c41a" }}
                            >
                                Gửi email cho {selectedRowKeys.length} nhân viên đã chọn
                            </Button>
                        )}
                        {(role === "admin" || role === "accountant") && (
                            <>
                                <Button
                                    type="primary"
                                    icon={<PlusOutlined />}
                                    onClick={() => router.push("/dashboard/payroll/new")}
                                >
                                    Tạo bảng lương mới
                                </Button>
                                <Button
                                    icon={<FileExcelOutlined />}
                                    onClick={() => setImportModalVisible(true)}
                                >
                                    Import Excel/CSV
                                </Button>
                            </>
                        )}
                    </Space>
                </div>

                <Table
                    rowSelection={rowSelection}
                    columns={columns}
                    dataSource={filteredPayrolls}
                    loading={loading}
                    pagination={{
                        pageSize: 10,
                        showSizeChanger: true,
                        showTotal: (total) => `Tổng ${total} bảng lương`,
                    }}
                />

                {/* Modal Import */}
                <Modal
                    title="📥 Import bảng lương từ file Excel/CSV"
                    open={importModalVisible}
                    onCancel={handleImportModalClose}
                    onOk={handleImport}
                    okText="Import"
                    cancelText="Hủy"
                    confirmLoading={importing}
                    width={600}
                    okButtonProps={{ disabled: importing }}
                >
                    <div className="space-y-4">
                        <Alert
                            message="Hướng dẫn"
                            description={
                                <div className="mt-2">
                                    <Text strong>Định dạng file:</Text>
                                    <ul className="list-disc list-inside mt-1 space-y-1">
                                        <li>File Excel (.xlsx, .xls) hoặc CSV (.csv)</li>
                                        <li>Kích thước tối đa: 10MB</li>
                                    </ul>
                                    <Text strong className="block mt-2">
                                        Cấu trúc file:
                                    </Text>
                                    <ul className="list-disc list-inside mt-1 space-y-1">
                                        <li>
                                            <Text code>Tên nhân viên</Text> hoặc <Text code>Email</Text> (bắt buộc)
                                        </li>
                                        <li>
                                            <Text code>Lương cơ bản</Text> (bắt buộc, phải lớn hơn 0)
                                        </li>
                                        <li>
                                            <Text code>Thưởng</Text> (tùy chọn, mặc định 0)
                                        </li>
                                        <li>
                                            <Text code>Khấu trừ</Text> (tùy chọn, mặc định 0)
                                        </li>
                                        <li>
                                            <Text code>Ngày thanh toán</Text> (tùy chọn, mặc định ngày hiện tại)
                                        </li>
                                    </ul>
                                    <Text className="block mt-2 text-xs text-gray-500">
                                        Lưu ý: Hệ thống sẽ tự động tính <Text code>Lương thực nhận</Text> = Lương cơ bản + Thưởng - Khấu trừ
                                    </Text>
                                </div>
                            }
                            type="info"
                            showIcon
                            className="mb-4"
                        />

                        <Upload
                            fileList={fileList}
                            beforeUpload={(file) => {
                                const fileName = file.name.toLowerCase();
                                const hasValidExtension =
                                    fileName.endsWith(".xlsx") ||
                                    fileName.endsWith(".xls") ||
                                    fileName.endsWith(".csv");

                                const isValidMimeType =
                                    file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
                                    file.type === "application/vnd.ms-excel" ||
                                    file.type === "text/csv" ||
                                    file.type === "application/octet-stream";

                                const isValidType = hasValidExtension || isValidMimeType;

                                if (!isValidType) {
                                    message.error(
                                        "Chỉ chấp nhận file Excel (.xlsx, .xls) hoặc CSV (.csv)"
                                    );
                                    return false;
                                }

                                if (file.size > 10 * 1024 * 1024) {
                                    message.error("File quá lớn. Kích thước tối đa là 10MB");
                                    return false;
                                }

                                setFileList([file]);
                                return false; // Ngăn tự động upload
                            }}
                            onChange={(info) => {
                                if (info.fileList.length > 0) {
                                    setFileList(info.fileList);
                                }
                            }}
                            onRemove={() => {
                                setFileList([]);
                                return true;
                            }}
                            maxCount={1}
                            accept=".xlsx,.xls,.csv"
                        >
                            <Button icon={<UploadOutlined />}>Chọn file</Button>
                        </Upload>

                        {importResult && (
                            <div className="mt-4">
                                <Alert
                                    message={
                                        `Import hoàn tất: ${importResult.success} thành công, ${importResult.failed} thất bại` +
                                        (typeof importResult.skipped === "number"
                                            ? `, ${importResult.skipped} bị bỏ qua`
                                            : "")
                                    }
                                    type={importResult.failed === 0 ? "success" : "warning"}
                                    showIcon
                                    className="mb-2"
                                />
                                {importResult.errors.length > 0 && (
                                    <div className="mt-2 max-h-40 overflow-y-auto">
                                        <Text strong className="text-red-600">
                                            Chi tiết lỗi:
                                        </Text>
                                        <ul className="list-disc list-inside mt-1 space-y-1 text-sm">
                                            {importResult.errors.map((err, idx) => {
                                                const isSkipped = err.type === "skipped";
                                                return (
                                                    <li key={idx}>
                                                        Dòng {err.row}: {err.name} -{" "}
                                                        {isSkipped ? "[BỎ QUA] " : ""}
                                                        {err.error}
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </Modal>
            </Content>
        </Layout>
    );
}

