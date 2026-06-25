"use client";

import { useEffect, useState } from "react";
import {
    Table,
    Button,
    Popconfirm,
    message,
    Spin,
    Tag,
    Space,
    Modal,
    Upload,
    Typography,
    Alert,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import type { UploadFile } from "antd";
import { useRouter } from "next/navigation";
import { UploadOutlined, FileExcelOutlined, DeleteOutlined } from "@ant-design/icons";
import {
    getMedicineImports,
    deleteMedicineImport,
    MedicineImport,
} from "@/lib/services/medicineImportsService";
import dayjs from "dayjs";

const { Text } = Typography;

export default function MedicineImportsPage() {
    const [imports, setImports] = useState<MedicineImport[]>([]);
    const [loading, setLoading] = useState(true);
    const [role, setRole] = useState<string>("");
    const [importModalVisible, setImportModalVisible] = useState(false);
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState<{
        success: number;
        failed: number;
        skipped?: number;
        errors: Array<{ row: number; medicine: string; error: string; type?: string }>;
    } | null>(null);
    const [fileList, setFileList] = useState<UploadFile[]>([]);
    const [importMode, setImportMode] = useState<"import" | "update">("import");
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
    const [deleting, setDeleting] = useState(false);
    const router = useRouter();

    // TỰ VIẾT
    const fetchImports = async () => {
        try {
            setLoading(true);
            const data = await getMedicineImports();
            setImports(data);
        } catch (error) {
            console.error("Fetch medicine imports error:", error);
            message.error("Không thể tải danh sách nhập thuốc");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchImports();
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

    const handleDelete = async (_id: string) => {
        try {
            await deleteMedicineImport(_id);
            message.success("Đã xóa nhập thuốc");
            fetchImports();
        } catch {
            message.error("Xóa thất bại");
        }
    };
    // 

    const handleBatchDelete = async () => {
        if (selectedRowKeys.length === 0) {
            message.warning("Vui lòng chọn ít nhất một bản ghi để xóa");
            return;
        }

        try {
            setDeleting(true);
            let successCount = 0;
            let failCount = 0;

            for (const id of selectedRowKeys) {
                try {
                    await deleteMedicineImport(String(id));
                    successCount++;
                } catch (error) {
                    failCount++;
                    console.error(`Failed to delete ${id}:`, error);
                }
            }

            if (successCount > 0) {
                message.success(`Đã xóa thành công ${successCount} nhập thuốc${failCount > 0 ? `, ${failCount} thất bại` : ""}`);
            } else {
                message.error("Xóa thất bại");
            }

            setSelectedRowKeys([]);
            fetchImports();
        } catch (error) {
            message.error("Có lỗi xảy ra khi xóa");
        } finally {
            setDeleting(false);
        }
    };

    const canDelete = role === "admin";
    const canCreate = role === "admin" || role === "accountant" || role === "pharmacist";
    const canImport = role === "admin" || role === "accountant" || role === "pharmacist";

    const handleImport = async () => {

        if (fileList.length === 0) {
            console.warn(" Không có file được chọn");
            message.warning("Vui lòng chọn file để import");
            return;
        }

        const fileItem = fileList[0];
        const file = fileItem?.originFileObj || fileItem;

        if (!file || !(file instanceof File)) {
            console.error("❌ File không hợp lệ hoặc không phải File object", { file, fileItem });
            message.warning("File không hợp lệ. Vui lòng chọn lại file.");
            return;
        }

        setImporting(true);
        setImportResult(null);

        try {
            const formData = new FormData();
            formData.append("file", file);

            console.log("Đang gửi file import...", file.name, file.size);

            const endpoint =
                importMode === "update"
                    ? "/api/medicine-imports/update-quantities"
                    : "/api/medicine-imports/import";

            const res = await fetch(endpoint, {
                method: "POST",
                body: formData,
            });

            console.log("Response status:", res.status, res.statusText);

            const text = await res.text();
            console.log("Response text:", text);
            let data: any = {};
            try {
                data = text ? JSON.parse(text) : {};
            } catch (parseError) {
                data = { __raw: text };
                console.warn("Response is not JSON:", parseError);
            }

            if (!res.ok) {
                const errorMsg = data.error || data.message || data.__raw || `HTTP ${res.status} ${res.statusText}`;
                console.error("Import failed:", errorMsg, data);
                const payloadErr = data.results || data;
                const skippedErr = payloadErr.skipped || 0;
                setImportResult({
                    success: payloadErr.success || 0,
                    failed: payloadErr.failed || 0,
                    skipped: skippedErr,
                    errors: payloadErr.errors || [],
                });
                message.error(errorMsg);
                return;
            }

            console.log("Import success data:", data);
            const payload = data.results || data;
            const skipped = payload.skipped || 0;
            setImportResult({
                success: payload.success || 0,
                failed: payload.failed || 0,
                skipped,
                errors: payload.errors || [],
            });

            if (payload.success > 0) {
                message.success(
                    `Import thành công ${payload.success} nhập thuốc` +
                    (payload.failed > 0 ? `, ${payload.failed} thất bại` : "") +
                    (skipped > 0 ? `, ${skipped} bị bỏ qua (đã tồn tại trong hệ thống)` : "")
                );
                fetchImports(); // Refresh danh sách
            } else if (payload.failed > 0) {
                message.warning(`Import thất bại: ${payload.failed} nhập thuốc không thể import`);
            } else {
                message.warning("Không có nhập thuốc nào được import thành công");
            }
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : "Lỗi khi import file";
            console.error("Import error:", error);
            message.error(errorMessage);
            setImportResult({
                success: 0,
                failed: 0,
                errors: [{ row: 0, medicine: "", error: errorMessage }],
            });
        } finally {
            setImporting(false);
        }
    };

    // TỰ VIẾT
    const handleImportModalClose = () => {
        setImportModalVisible(false);
        setFileList([]);
        setImportResult(null);
    };
    // 
    const getMedicineName = (medicine: string | any) => {
        if (!medicine) return "N/A";
        if (typeof medicine === "string") return medicine;
        if (typeof medicine === "object" && medicine.name) {
            return medicine.name;
        }
        return "N/A";
    };

    const getImporterName = (importer: string | any) => {
        if (!importer) return "N/A";
        if (typeof importer === "string") return importer;
        if (typeof importer === "object" && importer.fullname) {
            return importer.fullname;
        }
        return "N/A";
    };

    const columns: ColumnsType<MedicineImport> = [
        {
            title: "Medicine ID",
            dataIndex: "medicine_id",
            key: "medicine_id",
            width: 220,
            render: (medicine) => {
                if (!medicine) return "N/A";
                if (typeof medicine === "string") return medicine;
                if (typeof medicine === "object" && medicine._id) return String(medicine._id);
                return "N/A";
            },
        },
        {
            title: "Thuốc",
            dataIndex: "medicine_id",
            key: "medicine",
            width: 200,
            render: (medicine) => getMedicineName(medicine),
        },
        {
            title: "Số lượng",
            dataIndex: "quantity",
            key: "quantity",
            width: 100,
            render: (quantity) => (quantity ?? 0).toLocaleString(),
        },
        {
            title: "Còn lại",
            dataIndex: "remaining",
            key: "remaining",
            width: 100,
            render: (remaining, record) => {
                const remainingValue = remaining ?? 0;
                const quantity = record.quantity ?? 1;
                const percentage = quantity > 0 ? (remainingValue / quantity) * 100 : 0;
                let color = "green";
                if (percentage < 20) color = "red";
                else if (percentage < 50) color = "orange";
                const percentageDisplay = percentage < 1 && percentage > 0
                    ? percentage.toFixed(1)
                    : percentage.toFixed(0);
                return (
                    <Tag color={color}>
                        {remainingValue.toLocaleString()} ({percentageDisplay}%)
                    </Tag>
                );
            },
        },
        {
            title: "Giá nhập",
            dataIndex: "unit_price",
            key: "unit_price",
            width: 120,
            render: (price: number) => {
                const priceValue = price ?? 0;
                return new Intl.NumberFormat("vi-VN", {
                    style: "currency",
                    currency: "VND",
                }).format(priceValue);
            },
        },
        {
            title: "Hạn sử dụng",
            dataIndex: "expiry_date",
            key: "expiry_date",
            width: 120,
            render: (date: string) => {
                const expiryDate = dayjs(date);
                const isExpired = expiryDate.isBefore(dayjs());
                const isNearExpiry = expiryDate.isBefore(dayjs().add(30, "days"));
                return (
                    <Tag color={isExpired ? "red" : isNearExpiry ? "orange" : "green"}>
                        {expiryDate.format("DD/MM/YYYY")}
                    </Tag>
                );
            },
        },
        {
            title: "Ngày nhập",
            dataIndex: "import_date",
            key: "import_date",
            width: 120,
            render: (date: string) => dayjs(date).format("DD/MM/YYYY"),
        },
        {
            title: "Người nhập",
            dataIndex: "imported_by",
            key: "imported_by",
            width: 150,
            render: (importer) => getImporterName(importer),
        },
        {
            title: "Hành động",
            key: "action",
            width: 150,
            render: (_, record) => (
                <div className="flex gap-2">
                    {canDelete && (
                        <Popconfirm
                            title="Bạn có chắc chắn muốn xóa?"
                            onConfirm={() => handleDelete(record._id)}
                            okText="Xóa"
                            cancelText="Hủy"
                        >
                            <Button danger size="small">Xóa</Button>
                        </Popconfirm>
                    )}
                </div>
            ),
        },
    ];

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-4">Danh sách nhập thuốc</h1>

            <Space className="mb-4">
                {canCreate && (
                    <>
                        <Button
                            type="primary"
                            onClick={() => router.push("/dashboard/medicine-imports/new")}
                        >
                            + Nhập thuốc mới
                        </Button>
                        {canImport && (
                            <Button
                                icon={<FileExcelOutlined />}
                                onClick={() => setImportModalVisible(true)}
                            >
                                Import Excel/CSV
                            </Button>
                        )}
                    </>
                )}
                {canDelete && selectedRowKeys.length > 0 && (
                    <Popconfirm
                        title={`Bạn có chắc chắn muốn xóa ${selectedRowKeys.length} nhập thuốc đã chọn?`}
                        onConfirm={handleBatchDelete}
                        okText="Xóa"
                        cancelText="Hủy"
                        okButtonProps={{ danger: true, loading: deleting }}
                    >
                        <Button
                            danger
                            icon={<DeleteOutlined />}
                            loading={deleting}
                        >
                            Xóa đã chọn ({selectedRowKeys.length})
                        </Button>
                    </Popconfirm>
                )}
            </Space>

            {loading ? (
                <div className="flex justify-center items-center py-10">
                    <Spin size="large" />
                </div>
            ) : (
                <Table
                    rowKey="_id"
                    columns={columns}
                    dataSource={imports}
                    pagination={{ pageSize: 10 }}
                    bordered
                    rowSelection={
                        canDelete
                            ? {
                                selectedRowKeys,
                                onChange: (newSelectedRowKeys) => {
                                    setSelectedRowKeys(newSelectedRowKeys);
                                },
                                getCheckboxProps: (record) => ({
                                    name: record._id,
                                }),
                            }
                            : undefined
                    }
                />
            )}

            {/* Modal Import */}
            <Modal
                title="📥 Import nhập thuốc từ file Excel/CSV"
                open={importModalVisible}
                onCancel={handleImportModalClose}
                onOk={async () => {
                    console.log("🔘 Modal OK button clicked");
                    await handleImport();
                }}
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
                                        <Text code>Tên thuốc</Text> (bắt buộc, nếu chưa có sẽ tự động tạo mới)
                                    </li>
                                    <li>
                                        <Text code>Danh mục</Text> (tùy chọn, phân cách bằng dấu phẩy - chỉ cần khi tạo thuốc mới)
                                    </li>
                                    <li>
                                        <Text code>Đơn vị</Text> (bắt buộc khi tạo thuốc mới, ví dụ: viên, hộp, chai)
                                    </li>
                                    <li>
                                        <Text code>Giá bán</Text> (bắt buộc khi tạo thuốc mới, giá bán cho bệnh nhân)
                                    </li>
                                    <li>
                                        <Text code>Nhà cung cấp</Text> (bắt buộc)
                                    </li>
                                    <li>
                                        <Text code>Mã lô</Text> (bắt buộc)
                                    </li>
                                    <li>
                                        <Text code>Số lượng</Text> (bắt buộc, phải lớn hơn 0)
                                    </li>
                                    <li>
                                        <Text code>Giá nhập</Text> (bắt buộc, phải lớn hơn 0, giá nhập từ nhà cung cấp)
                                    </li>
                                    <li>
                                        <Text code>Hạn sử dụng</Text> (bắt buộc, định dạng: d/m/Y hoặc YYYY-MM-DD)
                                    </li>
                                    <li>
                                        <Text code>Ngày nhập</Text> (bắt buộc, định dạng: d/m/Y hoặc YYYY-MM-DD)
                                    </li>
                                    <li>
                                        <Text code>Người nhập</Text> (bắt buộc, tên nhân viên phải tồn tại)
                                    </li>
                                </ul>
                                <Alert
                                    message="Lưu ý"
                                    description="Nếu thuốc chưa tồn tại trong hệ thống, hệ thống sẽ tự động tạo mới dựa trên thông tin Tên thuốc, Danh mục, Đơn vị và Giá bán trong file."
                                    type="info"
                                    showIcon
                                    className="mt-2"
                                />
                            </div>
                        }
                        type="info"
                        showIcon
                        className="mb-4"
                    />

                    <div className="mb-3">
                        <label className="block mb-1 font-medium">Chế độ xử lý file</label>
                        <div>
                            <input
                                type="radio"
                                id="mode-import"
                                name="importMode"
                                checked={importMode === "import"}
                                onChange={() => setImportMode("import")}
                            />
                            <label htmlFor="mode-import" className="ml-2">Import nhập thuốc (theo flow hiện tại)</label>
                        </div>
                        <div className="mt-2">
                            <input
                                type="radio"
                                id="mode-update"
                                name="importMode"
                                checked={importMode === "update"}
                                onChange={() => setImportMode("update")}
                            />
                            <label htmlFor="mode-update" className="ml-2">Cập nhật số lượng theo file</label>
                        </div>
                    </div>

                    <Upload
                        fileList={fileList}
                        beforeUpload={(file) => {
                            console.log("📤 File được chọn:", {
                                name: file.name,
                                type: file.type,
                                size: file.size
                            });

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
                                console.error("File type không hợp lệ");
                                message.error(
                                    "Chỉ chấp nhận file Excel (.xlsx, .xls) hoặc CSV (.csv)"
                                );
                                return false;
                            }

                            if (file.size > 10 * 1024 * 1024) {
                                console.error(" File quá lớn");
                                message.error("File quá lớn. Kích thước tối đa là 10MB");
                                return false;
                            }

                            setFileList([file]);
                            return false;
                        }}
                        onChange={(info) => {

                            if (info.fileList.length > 0) {
                                setFileList(info.fileList);
                            }
                        }}
                        onRemove={() => {
                            console.log("🗑️ File bị xóa");
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
                                    (typeof importResult.skipped === "number" && importResult.skipped > 0
                                        ? `, ${importResult.skipped} bị bỏ qua`
                                        : "")
                                }
                                type={importResult.failed === 0 ? "success" : "warning"}
                                showIcon
                                className="mb-2"
                            />
                            {/* Chỉ hiển thị các lỗi failed, không hiển thị skipped */}
                            {importResult.errors.filter((err) => err.type !== "skipped").length > 0 && (
                                <div className="mt-2 max-h-40 overflow-y-auto">
                                    <Text strong className="text-red-600">
                                        Chi tiết lỗi:
                                    </Text>
                                    <ul className="list-disc list-inside mt-1 space-y-1 text-sm">
                                        {importResult.errors
                                            .filter((err) => err.type !== "skipped")
                                            .map((err, idx) => (
                                                <li key={idx}>
                                                    Dòng {err.row}: {err.medicine} - {err.error}
                                                </li>
                                            ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </Modal>
        </div>
    );
}

