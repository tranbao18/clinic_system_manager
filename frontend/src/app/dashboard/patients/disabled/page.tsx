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
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useRouter } from "next/navigation";
import { getDisabledPatients, restorePatient, deletePatient, Patient } from "@/lib/services/patientsService";
import { UndoOutlined, ArrowLeftOutlined } from "@ant-design/icons";

const { Search } = Input;

const mapGenderFromApiValue = (gender: string) => {
    if (gender === "Male") return "Nam";
    if (gender === "Female") return "Nữ";
    return gender;
};

export default function DisabledPatientsPage() {
    const [patients, setPatients] = useState<Patient[]>([]);
    const [filteredPatients, setFilteredPatients] = useState<Patient[]>([]);
    const [deletingPatientId, setDeletingPatientId] = useState<string | null>(null);
    const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
    const [bulkDeleting, setBulkDeleting] = useState(false);
    const [loading, setLoading] = useState(true);
    const [searchText, setSearchText] = useState("");
    const router = useRouter();

    // TỰ VIẾT
    const fetchPatients = async () => {
        try {
            setLoading(true);
            const data = await getDisabledPatients();

            const mappedList = data.map((patient: any) => ({
                ...patient,
                gender: mapGenderFromApiValue(patient.gender),
            }));

            setPatients(mappedList);
            setFilteredPatients(mappedList);
        } catch (error) {
            console.error("Fetch disabled patients error:", error);
            message.error("Không thể tải danh sách bệnh nhân đã xóa");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPatients();
    }, []);
    // 
    const normalizeText = (str: string) =>
        str
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-zA-Z0-9\s]/g, "")
            .toLowerCase()
            .trim();

    // TỰ VIẾT
    const onSearch = (value: string) => {
        setSearchText(value);
        const search = normalizeText(value);

        if (!search) {
            setFilteredPatients(patients);
        } else {
            const filtered = patients.filter((item) =>
                normalizeText(item.fullname).includes(search)
            );
            setFilteredPatients(filtered);
        }
    };

    const handleRestore = async (_id: string) => {
        try {
            await restorePatient(_id);
            message.success("Đã khôi phục bệnh nhân");
            fetchPatients();
        } catch {
            message.error("Khôi phục thất bại");
        }
    };

    const handlePermanentDelete = async (id: string) => {
        try {
            setDeletingPatientId(id);
            await deletePatient(id, true);
            message.success("Đã xóa vĩnh viễn bệnh nhân");
            fetchPatients();
        } catch (err: any) {
            console.error("Permanent delete patient failed:", err);
            message.error(err.message || "Xóa vĩnh viễn thất bại");
        } finally {
            setDeletingPatientId(null);
        }
    };
    // 
    const handleBulkPermanentDelete = async () => {
        if (!selectedRowKeys || selectedRowKeys.length === 0) return;
        const ids = selectedRowKeys.map(k => String(k));
        try {
            setBulkDeleting(true);
            const results = await Promise.allSettled(ids.map(id => deletePatient(id, true)));
            const successCount = results.filter(r => r.status === "fulfilled").length;
            const failCount = results.length - successCount;
            if (successCount > 0) {
                message.success(`Đã xóa vĩnh viễn ${successCount} bệnh nhân`);
            }
            if (failCount > 0) {
                message.error(`${failCount} bệnh nhân xóa thất bại`);
            }
            setSelectedRowKeys([]);
            fetchPatients();
        } catch (err: any) {
            console.error("Bulk delete patients failed:", err);
            message.error(err.message || "Xóa hàng loạt thất bại");
        } finally {
            setBulkDeleting(false);
        }
    };

    const columns: ColumnsType<Patient> = [
        {
            title: "Họ và tên",
            dataIndex: "fullname",
            key: "fullname",
        },
        {
            title: "Giới tính",
            dataIndex: "gender",
            key: "gender",
        },
        {
            title: "Email",
            dataIndex: "email",
            key: "email",
        },
        {
            title: "Số điện thoại",
            dataIndex: "phone",
            key: "phone",
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
                            loading={deletingPatientId === record._id}
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
                        onClick={() => router.push("/dashboard/patients")}
                        className="mb-2"
                    >
                        Quay lại
                    </Button>
                    <h1 className="text-2xl font-bold">Danh sách bệnh nhân đã xóa</h1>

                </div>
            </div>

            <Space className="mb-4 flex flex-wrap" align="center">
                <Search
                    placeholder="Nhập tên bệnh nhân..."
                    allowClear
                    enterButton="Tìm kiếm"
                    onSearch={onSearch}
                    style={{ width: 300 }}
                />
                <div className="ml-4">
                    <Popconfirm
                        title={() => `Bạn có chắc chắn muốn xóa vĩnh viễn ${selectedRowKeys.length} bệnh nhân đã chọn?`}
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
                            disabled: bulkDeleting || deletingPatientId === record._id,
                        }),
                    }}
                    columns={columns}
                    dataSource={filteredPatients}
                    pagination={{ pageSize: 8 }}
                    bordered
                />
            )}
        </div>
    );
    // 
}

