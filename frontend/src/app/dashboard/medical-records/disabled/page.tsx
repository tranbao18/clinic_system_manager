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
    Descriptions,
    Card,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useRouter } from "next/navigation";
import {
    getDisabledMedicalRecords,
    restoreMedicalRecord,
    deleteMedicalRecord,
    MedicalRecord
} from "@/lib/services/medicalRecordService";
import { UndoOutlined, ArrowLeftOutlined, DeleteOutlined } from "@ant-design/icons";
import dayjs from "dayjs";

// Tên từ document đã populate; null (thuốc/bác sĩ đã bị xóa) → "—"
const refName = (ref: unknown, key = "fullname"): string => {
    if (ref && typeof ref === "object") {
        const value = (ref as Record<string, unknown>)[key];
        if (typeof value === "string" && value.trim()) return value;
    }
    return "—";
};

const { Search } = Input;

export default function DisabledMedicalRecordsPage() {
    const [medicalRecords, setMedicalRecords] = useState<MedicalRecord[]>([]);
    const [filteredMedicalRecords, setFilteredMedicalRecords] = useState<MedicalRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchText, setSearchText] = useState("");
    const [role, setRole] = useState<string>("");
    const [roleLoaded, setRoleLoaded] = useState(false);
    const [restoringId, setRestoringId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const router = useRouter();
    // Khôi phục và xóa vĩnh viễn chỉ dành cho Admin (backend cũng chặn)
    const isAdmin = role === "admin";

    useEffect(() => {
        try {
            const userData = sessionStorage.getItem("user") || localStorage.getItem("user");
            const parsed = userData ? JSON.parse(userData) : null;
            setRole(String(parsed?.role || "").toLowerCase());
        } catch {
            setRole("");
        } finally {
            setRoleLoaded(true);
        }
    }, []);

    // TỰ VIẾT
    const fetchMedicalRecords = async () => {
        try {
            setLoading(true);
            const data = await getDisabledMedicalRecords();
            setMedicalRecords(data);
            setFilteredMedicalRecords(data);
        } catch (error: any) {
            console.error("Fetch disabled medical records error:", error);
            message.error(error?.message || "Không thể tải danh sách hồ sơ y tế đã xóa");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!roleLoaded) return;
        if (!isAdmin) {
            setLoading(false);
            return;
        }
        fetchMedicalRecords();
    }, [roleLoaded, isAdmin]);
    // 

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
            setFilteredMedicalRecords(medicalRecords);
        } else {
            const filtered = medicalRecords.filter((record) => {
                const diagnosisMatch = normalizeText(record.diagnosis || "").includes(search);
                const treatmentMatch = normalizeText(record.treatment || "").includes(search);
                const notesMatch = normalizeText(record.notes || "").includes(search);
                const patientName = normalizeText(refName(record.patient_id).replace("—", ""));
                const patientMatch = patientName.includes(search);
                const doctorName = normalizeText(refName(record.doctor_id).replace("—", ""));
                const doctorMatch = doctorName.includes(search);
                return diagnosisMatch || treatmentMatch || notesMatch || patientMatch || doctorMatch;
            });
            setFilteredMedicalRecords(filtered);
        }
    };

    // TỰ VIẾT
    const handleRestore = async (_id: string) => {
        try {
            setRestoringId(_id);
            await restoreMedicalRecord(_id);
            message.success("Đã khôi phục hồ sơ y tế");
            fetchMedicalRecords();
        } catch (error: any) {
            message.error(error?.message || "Khôi phục thất bại");
        } finally {
            setRestoringId(null);
        }
    };

    const handlePermanentDelete = async (_id: string) => {
        try {
            setDeletingId(_id);
            await deleteMedicalRecord(_id, true);
            message.success("Đã xóa vĩnh viễn hồ sơ y tế");
            fetchMedicalRecords();
        } catch (error: any) {
            message.error(error?.message || "Xóa vĩnh viễn thất bại");
        } finally {
            setDeletingId(null);
        }
    };
    // 


    const formatDate = (date: string) =>
        date ? dayjs(date).format("DD/MM/YYYY HH:mm") : "—";

    const columns: ColumnsType<MedicalRecord> = [
        {
            title: "Bệnh nhân",
            key: "patient",
            width: 200,
            render: (_, record) => refName(record.patient_id),
        },
        {
            title: "Bác sĩ",
            key: "doctor",
            width: 150,
            render: (_, record) => refName(record.doctor_id),
        },
        {
            title: "Chẩn đoán",
            dataIndex: "diagnosis",
            key: "diagnosis",
            width: 250,
            ellipsis: true,
        },
        {
            title: "Hành động",
            key: "action",
            width: 260,
            render: (_, record) => (
                <div className="flex gap-2">
                    <Popconfirm
                        title="Bạn có chắc chắn muốn khôi phục?"
                        onConfirm={() => handleRestore(record._id)}
                        okText="Khôi phục"
                        cancelText="Hủy"
                    >
                        <Button
                            type="primary"
                            icon={<UndoOutlined />}
                            loading={restoringId === record._id}
                        >
                            Khôi phục
                        </Button>
                    </Popconfirm>
                    <Popconfirm
                        title="Xóa vĩnh viễn hồ sơ y tế này?"
                        description="Hành động này không thể hoàn tác."
                        onConfirm={() => handlePermanentDelete(record._id)}
                        okText="Xóa vĩnh viễn"
                        cancelText="Hủy"
                        okButtonProps={{ danger: true }}
                    >
                        <Button
                            danger
                            icon={<DeleteOutlined />}
                            loading={deletingId === record._id}
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
                        onClick={() => router.back()}
                        className="mb-2"
                    >
                        Quay lại
                    </Button>
                    <h1 className="text-2xl font-bold">Danh sách hồ sơ y tế đã xóa</h1>
                </div>
            </div>

            <Space className="mb-4 flex flex-wrap" align="center">
                <Search
                    placeholder="Tìm kiếm theo chẩn đoán, bệnh nhân, bác sĩ..."
                    allowClear
                    enterButton="Tìm kiếm"
                    onSearch={onSearch}
                    style={{ width: 400 }}
                />
            </Space>

            {roleLoaded && !isAdmin ? (
                <div className="py-10 text-center text-gray-500">
                    Chỉ Admin được xem và khôi phục hồ sơ y tế đã xóa.
                </div>
            ) : loading ? (
                <div className="flex justify-center items-center py-10">
                    <Spin size="large" />
                </div>
            ) : (
                <Table
                    rowKey="_id"
                    columns={columns}
                    dataSource={filteredMedicalRecords}
                    pagination={{ pageSize: 10 }}
                    bordered
                    expandable={{
                        expandedRowRender: (record) => (
                            <div style={{ margin: 0 }}>
                                <Descriptions column={1} size="small" bordered>
                                    <Descriptions.Item label="Chẩn đoán">
                                        {record.diagnosis}
                                    </Descriptions.Item>
                                    {record.treatment && (
                                        <Descriptions.Item label="Điều trị">
                                            {record.treatment}
                                        </Descriptions.Item>
                                    )}
                                    {record.notes && (
                                        <Descriptions.Item label="Ghi chú">
                                            {record.notes}
                                        </Descriptions.Item>
                                    )}
                                    {record.prescriptions && record.prescriptions.length > 0 && (
                                        <Descriptions.Item label="Toa thuốc">
                                            <div className="space-y-1">
                                                {record.prescriptions.map((p: any, idx: number) => (
                                                    <div key={idx} className="text-sm">
                                                        • {refName(p.medicine_id, "name")} - Số lượng: {p.quantity} - Liều: {p.dosage || "—"}
                                                    </div>
                                                ))}
                                            </div>
                                        </Descriptions.Item>
                                    )}
                                    <Descriptions.Item label="Ngày tạo">
                                        {formatDate(record.created_at)}
                                    </Descriptions.Item>
                                    <Descriptions.Item label="Cập nhật">
                                        {formatDate(record.updated_at)}
                                    </Descriptions.Item>
                                </Descriptions>
                            </div>
                        ),
                        rowExpandable: () => true,
                    }}
                />
            )}
        </div>
    );
    // 
}

