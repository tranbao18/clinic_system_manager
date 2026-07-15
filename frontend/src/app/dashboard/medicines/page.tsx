
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
    Modal,
    Upload,
    Typography,
    Alert,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import type { UploadFile } from "antd";
import { useRouter } from "next/navigation";
import { UploadOutlined, FileExcelOutlined, DeleteOutlined } from "@ant-design/icons";
import { getMedicines, deleteMedicine, Medicine } from "@/lib/services/medicinesService";

const { Search } = Input;
const { Option } = Select;
const { Text } = Typography;


export default function MedicinesPage() {
    const [medicines, setMedicines] = useState<Medicine[]>([]);
    const [filteredMedicines, setFilteredMedicines] = useState<Medicine[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchText, setSearchText] = useState("");
    const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
    const [role, setRole] = useState<string>("");
    const [importModalVisible, setImportModalVisible] = useState(false);
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState<{
        success: number;
        failed: number;
        skipped?: number;
        errors: Array<{ row: number; name: string; error: string; type?: string }>;
    } | null>(null);
    const [fileList, setFileList] = useState<UploadFile[]>([]);
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
    const [deleting, setDeleting] = useState(false);
    const router = useRouter();

    // TỰ VIẾT
    const fetchMedicines = async () => {
        try {
            setLoading(true);
            const data = await getMedicines();
            setMedicines(data);
            setFilteredMedicines(data);
        } catch (error) {
            console.error("Fetch medicines error:", error);
            message.error("Không thể tải danh sách thuốc");
        } finally {
            setLoading(false);
        }
    };
    //

    useEffect(() => {
        fetchMedicines();
    }, []);

    // TỰ VIẾT
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

    // TỰ VIẾT
    const normalizeText = (str: string) =>
        str
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-zA-Z0-9\s]/g, "")
            .toLowerCase()
            .trim();
    //

    // TỰ VIẾT
    const handleFilter = (text: string, category: string | null) => {
        let filtered = [...medicines];
        const search = normalizeText(text);

        if (search) {
            filtered = filtered.filter((item) => {
                const nameMatch = normalizeText(item.name).includes(search);
                const categories = Array.isArray(item.category) ? item.category : (item.category ? [item.category] : []);
                const categoryMatch = categories.some((cat) =>
                    normalizeText(cat).includes(search)
                );
                return nameMatch || categoryMatch;
            });
        }

        if (category) {
            filtered = filtered.filter((item) => {
                const categories = Array.isArray(item.category) ? item.category : (item.category ? [item.category] : []);
                return categories.includes(category);
            });
        }

        setFilteredMedicines(filtered);
    };
    //

    // TỰ VIẾT
    const onSearch = (value: string) => {
        setSearchText(value);
        handleFilter(value, categoryFilter);
    };
    //

    // TỰ VIẾT
    const onCategoryChange = (value: string | null) => {
        setCategoryFilter(value);
        handleFilter(searchText, value);
    };
    //

    // TỰ VIẾT
    const handleDelete = async (_id: string) => {
        try {
            await deleteMedicine(_id);
            message.success("Đã xóa thuốc");
            fetchMedicines();
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
                    await deleteMedicine(String(id));
                    successCount++;
                } catch (error) {
                    failCount++;
                    console.error(`Failed to delete ${id}:`, error);
                }
            }

            if (successCount > 0) {
                message.success(`Đã xóa thành công ${successCount} thuốc${failCount > 0 ? `, ${failCount} thất bại` : ""}`);
            } else {
                message.error("Xóa thất bại");
            }

            setSelectedRowKeys([]);
            fetchMedicines();
        } catch (error) {
            message.error("Có lỗi xảy ra khi xóa");
        } finally {
            setDeleting(false);
        }
    };

    const canDelete = role === "admin";
    const canCreate = role === "admin" || role === "accountant" || role === "pharmacist";
    const canUpdate = role === "admin" || role === "accountant" || role === "pharmacist";
    const canImport = role === "admin" || role === "accountant" || role === "pharmacist";

    const handleImport = async () => {

        if (fileList.length === 0) {
            console.warn("Không có file được chọn");
            message.warning("Vui lòng chọn file để import");
            return;
        }

        const fileItem = fileList[0];
        const file = fileItem?.originFileObj || fileItem;



        if (!file || !(file instanceof File)) {
            console.error(" File không hợp lệ hoặc không phải File object", { file, fileItem });
            message.warning("File không hợp lệ. Vui lòng chọn lại file.");
            return;
        }

        setImporting(true);
        setImportResult(null);

        try {
            const formData = new FormData();
            formData.append("file", file);

            console.log("Đang gửi file import...", file.name, file.size);

            const res = await fetch("/api/medicines/import", {
                method: "POST",
                body: formData,
            });


            let data;
            try {
                const text = await res.text();
                console.log("Response text:", text);
                data = text ? JSON.parse(text) : {};
            } catch (parseError) {
                console.error("Parse JSON error:", parseError);
                throw new Error("Không thể đọc phản hồi từ server");
            }

            if (!res.ok) {
                const errorMsg = data.error || data.message || "Không thể import file";
                console.error("Import failed:", errorMsg, data);
                const skipped = data.skipped || 0;
                setImportResult({
                    success: data.success || 0,
                    failed: data.failed || 0,
                    skipped,
                    errors: data.errors || [],
                });
                message.error(errorMsg);
                return;
            }

            console.log("Import success data:", data);

            const skipped = data.skipped || 0;
            setImportResult({
                success: data.success || 0,
                failed: data.failed || 0,
                skipped,
                errors: data.errors || [],
            });

            if (data.success > 0) {
                message.success(
                    `Import thành công ${data.success} thuốc` +
                    (data.failed > 0 ? `, ${data.failed} thất bại` : "") +
                    (skipped > 0 ? `, ${skipped} bị bỏ qua (đã tồn tại trong hệ thống)` : "")
                );
                fetchMedicines();
            } else if (data.failed > 0) {
                message.warning(`Import thất bại: ${data.failed} thuốc không thể import`);
            } else {
                message.warning("Không có thuốc nào được import thành công");
            }
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : "Lỗi khi import file";
            console.error("Import error:", error);
            message.error(errorMessage);
            setImportResult({
                success: 0,
                failed: 0,
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

    const categories = Array.from(
        new Set(
            medicines
                .flatMap((m) => {
                    if (Array.isArray(m.category)) {
                        return m.category;
                    }
                    return m.category ? [m.category] : [];
                })
                .filter(Boolean)
        )
    ).sort();

    const columns: ColumnsType<Medicine> = [
        {
            title: "Tên thuốc",
            dataIndex: "name",
            key: "name",
            width: 200,
        },
        {
            title: "Danh mục",
            dataIndex: "category",
            key: "category",
            width: 200,
            render: (category: string | string[]) => {
                const categories = Array.isArray(category) ? category : (category ? [category] : []);
                if (categories.length === 0) {
                    return <Tag color="default">Không có</Tag>;
                }
                return (
                    <div className="flex flex-wrap gap-1">
                        {categories.map((cat, idx) => (
                            <Tag key={idx} color="blue">
                                {cat}
                            </Tag>
                        ))}
                    </div>
                );
            },
        },
        {
            title: "Đơn vị",
            dataIndex: "unit",
            key: "unit",
            width: 100,
        },
        {
            title: "Giá",
            dataIndex: "price",
            key: "price",
            width: 120,
            render: (price: number) => {
                return new Intl.NumberFormat("vi-VN", {
                    style: "currency",
                    currency: "VND",
                }).format(price);
            },
        },
        {
            title: "Số lượng còn lại",
            dataIndex: "total_remaining",
            key: "total_remaining",
            width: 150,
            render: (totalRemaining: number | undefined, record: Medicine) => {
                const remaining = totalRemaining ?? 0;
                let color = "green";
                if (remaining === 0) color = "red";
                else if (remaining < 10) color = "orange";
                return (
                    <Tag color={color}>
                        {remaining.toLocaleString()} {record.unit || ""}
                    </Tag>
                );
            },
        },
        {
            title: "Hành động",
            key: "action",
            width: 200,
            render: (_, record) => (
                <div className="flex gap-2">
                    {canUpdate && (
                        <Button
                            type="primary"
                            onClick={() => router.push(`/dashboard/medicines/${record._id}/edit`)}
                        >
                            Sửa
                        </Button>
                    )}
                    {canDelete && (
                        <Popconfirm
                            title="Bạn có chắc chắn muốn xóa?"
                            onConfirm={() => handleDelete(record._id)}
                            okText="Xóa"
                            cancelText="Hủy"
                        >
                            <Button danger>Xóa</Button>
                        </Popconfirm>
                    )}
                </div>
            ),
        },
    ];

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-4">Danh sách thuốc</h1>

            <Space className="mb-4 flex flex-wrap" align="center">
                <Search
                    placeholder="Nhập tên thuốc hoặc danh mục..."
                    allowClear
                    enterButton="Tìm kiếm"
                    onSearch={onSearch}
                    style={{ width: 300 }}
                />

                <Select
                    placeholder="Lọc theo danh mục"
                    allowClear
                    onChange={onCategoryChange}
                    style={{ width: 200 }}
                >
                    {categories.map((cat) => (
                        <Option key={cat} value={cat}>
                            {cat}
                        </Option>
                    ))}
                </Select>

                {canCreate && (
                    <>
                        <Button
                            type="primary"
                            onClick={() => router.push("/dashboard/medicines/new")}
                        >
                            + Thêm thuốc
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
                {canDelete && (
                    <>
                        <Button
                            onClick={() => router.push("/dashboard/medicines/disabled")}
                        >
                            Thùng rác
                        </Button>
                        {selectedRowKeys.length > 0 && (
                            <Popconfirm
                                title={`Bạn có chắc chắn muốn xóa ${selectedRowKeys.length} thuốc đã chọn?`}
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
                    </>
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
                    dataSource={filteredMedicines}
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
                title="📥 Import thuốc từ file Excel/CSV"
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
                                        <Text code>Tên thuốc</Text> (bắt buộc)
                                    </li>
                                    <li>
                                        <Text code>Danh mục</Text> (tùy chọn, phân cách bằng dấu phẩy, tối đa 3)
                                    </li>
                                    <li>
                                        <Text code>Đơn vị</Text> (bắt buộc)
                                    </li>
                                    <li>
                                        <Text code>Giá</Text> (bắt buộc, phải lớn hơn 0)
                                    </li>
                                </ul>
                            </div>
                        }
                        type="info"
                        showIcon
                        className="mb-4"
                    />

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
                                file.type === "application/octet-stream"; // Một số trình duyệt trả về type này cho .xlsx

                            const isValidType = hasValidExtension || isValidMimeType;

                            console.log("✅ Validation:", {
                                hasValidExtension,
                                isValidMimeType,
                                isValidType
                            });

                            if (!isValidType) {
                                console.error("❌ File type không hợp lệ");
                                message.error(
                                    "Chỉ chấp nhận file Excel (.xlsx, .xls) hoặc CSV (.csv)"
                                );
                                return false;
                            }

                            if (file.size > 10 * 1024 * 1024) {
                                console.error("❌ File quá lớn");
                                message.error("File quá lớn. Kích thước tối đa là 10MB");
                                return false;
                            }

                            console.log("✅ File hợp lệ, thêm vào fileList");
                            setFileList([file]);
                            return false; // Ngăn tự động upload
                        }}
                        onChange={(info) => {
                            console.log("📝 Upload onChange:", {
                                fileList: info.fileList,
                                file: info.file,
                                fileListLength: info.fileList.length
                            });
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
                                                    Dòng {err.row}: {err.name} - {err.error}
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
//

