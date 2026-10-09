"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    Input,
    Button,
    Form,
    Spin,
    message,
    Card,
    Select,
    Row,
    Col,
    Descriptions,
    Empty,
    Table,
    Space,
    Modal,
    InputNumber,
    Popconfirm,
    Alert,
} from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined, DollarOutlined, PrinterOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import {
    updatePatient,
    Patient,
} from "@/lib/services/patientsService";
import {
    getMedicalRecordsByPatientId,
    createMedicalRecord,
    updateMedicalRecord,
    deleteMedicalRecord,
    MedicalRecord,
} from "@/lib/services/medicalRecordService";
import { printPrescription } from "@/components/PrintPrescription";
import { getMedicines, Medicine } from "@/lib/services/medicinesService";
import {
    createInvoiceFromMedicalRecord,
    getInvoicesByPatientId,
    Invoice,
} from "@/lib/services/invoiceService";
import { getAppointments, Appointment, updateAppointment, toIdString } from "@/lib/services/appointmentsService";

const mapGenderToApiValue = (gender: string) => {
    if (gender === "Nam") return "Male";
    if (gender === "Nữ") return "Female";
    return gender;
};

const mapGenderFromApiValue = (gender: string) => {
    if (gender === "Male") return "Nam";
    if (gender === "Female") return "Nữ";
    return gender;
};

// Chuẩn hóa ngày sinh về YYYY-MM-DD cho ô nhập <input type="date">
const toDateOnly = (value?: string | null): string => {
    if (!value) return "";
    const str = String(value);
    // Ngày lưu dạng UTC 00:00 (gửi lên là YYYY-MM-DD) → giữ nguyên phần ngày
    const exact = str.match(/^(\d{4}-\d{2}-\d{2})(T00:00:00(\.0+)?Z)?$/);
    if (exact) return exact[1];
    // Dữ liệu cũ gửi bằng toISOString() từ giờ địa phương → đổi lại theo giờ địa phương
    const d = dayjs(str);
    return d.isValid() ? d.format("YYYY-MM-DD") : "";
};

// Lấy tên từ document đã populate; null/chưa populate → "—"
const getRefName = (ref: unknown, key = "fullname"): string => {
    if (ref && typeof ref === "object") {
        const value = (ref as Record<string, unknown>)[key];
        if (typeof value === "string" && value.trim()) return value;
    }
    return "—";
};

// GET /api/appointments trả patient_id đã populate (object) → so sánh theo id
const filterAppointmentsForPatient = (list: Appointment[], patientId: string) =>
    list.filter((apt) => toIdString(apt.patient_id) === patientId);

const LINKABLE_APPOINTMENT_STATUSES = ["Completed", "Scheduled", "Confirmed", "In Progress"];

// Lịch hẹn tốt nhất để gắn hồ sơ: chưa có hồ sơ, ưu tiên Completed rồi tới lịch gần nhất
const pickBestAppointment = (appointments: Appointment[], records: MedicalRecord[]): Appointment | null => {
    const linkedIds = new Set(records.map((mr) => toIdString(mr.appointment_id)).filter(Boolean));
    const candidates = appointments
        .filter((apt) => LINKABLE_APPOINTMENT_STATUSES.includes(apt.status) && !linkedIds.has(apt._id))
        .sort((a, b) => {
            if (a.status === "Completed" && b.status !== "Completed") return -1;
            if (a.status !== "Completed" && b.status === "Completed") return 1;
            return new Date(b.appointment_date).getTime() - new Date(a.appointment_date).getTime();
        });
    return candidates[0] || null;
};

// Số lượng từng thuốc đã kê trong hồ sơ đang sửa
const getOriginalQuantities = (record: MedicalRecord | null): Record<string, number> => {
    const result: Record<string, number> = {};
    (record?.prescriptions || []).forEach((p) => {
        const id = toIdString(p.medicine_id);
        if (id) result[id] = (result[id] || 0) + (Number(p.quantity) || 0);
    });
    return result;
};

// Backend trả 400 kèm `shortages` khi kho không đủ thuốc để tạo hóa đơn
interface StockShortage {
    name?: string;
    required?: number;
    available?: number;
}

export default function PatientDetailPage() {
    const { patientId } = useParams<{ patientId: string }>();
    const router = useRouter();
    const [form] = Form.useForm();
    const [medicalRecordForm] = Form.useForm();
    const [patient, setPatient] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    const [medicalRecords, setMedicalRecords] = useState<MedicalRecord[]>([]);
    const [loadingRecords, setLoadingRecords] = useState(false);
    const [medicines, setMedicines] = useState<Medicine[]>([]);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [isMedicalRecordModalVisible, setIsMedicalRecordModalVisible] = useState(false);
    const [editingRecord, setEditingRecord] = useState<MedicalRecord | null>(null);
    const [savingRecord, setSavingRecord] = useState(false);
    const [deletingRecordId, setDeletingRecordId] = useState<string | null>(null);

    const [appointments, setAppointments] = useState<Appointment[]>([]);

    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [creatingInvoice, setCreatingInvoice] = useState<string | null>(null);
    const [invoiceSuccessModalVisible, setInvoiceSuccessModalVisible] = useState(false);
    const [createdInvoice, setCreatedInvoice] = useState<Invoice | null>(null);

    // TỰ VIẾT
    useEffect(() => {
        if (!patientId) return;

        const fetchPatient = async () => {
            try {
                setLoading(true);
                const res = await fetch(`/api/patients/${patientId}`, {
                    cache: "no-store",
                });
                const data = await res.json();
                if (!res.ok)
                    throw new Error(data.error || "Không thể lấy thông tin bệnh nhân");

                const mappedData = {
                    ...data,
                    gender: mapGenderFromApiValue(data.gender),
                    dob: toDateOnly(data.dob),
                };

                setPatient(mappedData);
            } catch (err) {
                console.error(err);
                message.error("Không thể tải thông tin bệnh nhân");
            } finally {
                setLoading(false);
            }
        };

        fetchPatient();
    }, [patientId]);


    useEffect(() => {
        if (isEditing && patient) {
            form.setFieldsValue(patient);
        }
    }, [isEditing, patient, form]);

    useEffect(() => {
        if (!patientId) return;

        const fetchMedicalRecords = async () => {
            try {
                setLoadingRecords(true);
                const records = await getMedicalRecordsByPatientId(patientId);
                setMedicalRecords(records);
            } catch (err: any) {
                console.error(err);
                message.error(err?.message || "Không thể tải hồ sơ y tế");
            } finally {
                setLoadingRecords(false);
            }
        };

        fetchMedicalRecords();
    }, [patientId]);
    // 

    useEffect(() => {
        if (!patientId) return;

        const fetchAppointments = async () => {
            try {
                const allAppointments = await getAppointments();
                setAppointments(filterAppointmentsForPatient(allAppointments, patientId));
            } catch (err) {
                console.error("Error fetching appointments:", err);
                setAppointments([]);
            }
        };

        fetchAppointments();
    }, [patientId]);

    // TỰ VIẾT
    useEffect(() => {
        if (!patientId) return;

        const fetchInvoices = async () => {
            try {
                const invoiceList = await getInvoicesByPatientId(patientId);
                setInvoices(invoiceList || []);
            } catch (err) {
                console.error("Error fetching invoices:", err);
                setInvoices([]);
            }
        };

        fetchInvoices();
    }, [patientId]);

    useEffect(() => {
        const fetchMedicines = async () => {
            try {
                const meds = await getMedicines();
                setMedicines(meds);
            } catch (err) {
                console.error(err);
            }
        };

        fetchMedicines();
    }, []);


    useEffect(() => {
        const fetchCurrentUser = async () => {
            try {
                const userData = sessionStorage.getItem("user") || localStorage.getItem("user");
                if (userData) {
                    const data = JSON.parse(userData);
                    setCurrentUser(data);
                }
            } catch (err) {
                console.error(err);
            }
        };

        fetchCurrentUser();
    }, []);
    // 

    const userRole = currentUser?.role?.toLowerCase() || "";
    const currentEmployeeId = toIdString(currentUser?.employee_id);
    const isAdmin = userRole === "admin";
    const canManageMedicalRecords = isAdmin || userRole === "doctor";
    const canPrint = userRole !== "receptionist";
    // Backend chỉ cho Admin, Kế toán, Bác sĩ tạo hóa đơn
    const canCreateInvoiceRole = ["admin", "accountant", "doctor"].includes(userRole);
    // Bác sĩ chỉ được sửa/xóa hồ sơ do chính mình phụ trách
    const canEditRecord = (record: MedicalRecord) =>
        isAdmin ||
        (userRole === "doctor" && !!currentEmployeeId && toIdString(record.doctor_id) === currentEmployeeId);

    const handleUpdate = async (values: Partial<Patient>) => {
        try {
            setSaving(true);

            const payload = {
                ...patient,
                ...values,
                gender: mapGenderToApiValue(values.gender || patient.gender),
                dob: values.dob || patient.dob,
            };

            const updated = await updatePatient(patientId, payload);

            const displayData = {
                ...updated,
                gender: mapGenderFromApiValue(updated.gender),
                dob: toDateOnly(updated.dob),
            };

            setPatient(displayData);
            setIsEditing(false);
            message.success("Cập nhật thông tin thành công!");
        } catch (error: any) {
            console.error(error);
            message.error(error?.message || "Cập nhật thất bại");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center py-10">
                <Spin size="large" />
            </div>
        );
    }

    if (!patient) {
        return (
            <div className="flex justify-center items-center py-10">
                <p className="text-gray-500">Không tìm thấy bệnh nhân</p>
            </div>
        );
    }

    const formatDate = (date: string) =>
        date ? dayjs(date).format("DD/MM/YYYY") : "—";

    const formatDateTime = (date: string) =>
        date ? dayjs(date).format("DD/MM/YYYY HH:mm") : "—";

    const originalQuantities = getOriginalQuantities(editingRecord);

    // Thuốc hết hàng vẫn hiện nếu đã có trong toa đang sửa (để không mất thuốc đã kê)
    const medicineOptions = medicines
        .filter((med) => (med.total_remaining || 0) > 0 || !!originalQuantities[med._id])
        .map((med) => ({
            value: med._id,
            label: `${med.name} (${med.unit}) - Còn ${med.total_remaining || 0}`,
        }));
    (editingRecord?.prescriptions || []).forEach((p) => {
        const id = toIdString(p.medicine_id);
        if (id && !medicineOptions.some((o) => o.value === id)) {
            medicineOptions.push({ value: id, label: `${getRefName(p.medicine_id, "name")} (đã kê)` });
        }
    });

    // Kiểm tra tồn kho; thuốc đã kê sẵn trong hồ sơ đang sửa được giữ tới số lượng cũ dù kho đã hết
    const getStockError = (medicineId: string, quantity?: number): string | null => {
        const originalQty = originalQuantities[medicineId] || 0;
        const medicine = medicines.find((m) => m._id === medicineId);
        if (!medicine) {
            if (originalQty > 0) {
                return quantity && quantity > originalQty
                    ? `Không thể tăng số lượng thuốc này vượt quá ${originalQty} (thuốc không còn trong danh mục)`
                    : null;
            }
            return `Không tìm thấy thông tin thuốc với ID: ${medicineId}`;
        }
        const stockQuantity = medicine.total_remaining || 0;
        const unit = medicine.unit || "đơn vị";
        if (originalQty > 0) {
            const maxAllowed = Math.max(originalQty, stockQuantity);
            return quantity && quantity > maxAllowed
                ? `Không đủ hàng trong kho cho thuốc ${medicine.name}. Tối đa ${maxAllowed} ${unit} (đã kê ${originalQty}, tồn kho ${stockQuantity})`
                : null;
        }
        if (stockQuantity <= 0) return `Thuốc ${medicine.name} đã hết hàng trong kho`;
        if (quantity && quantity > stockQuantity) {
            return `Không đủ hàng trong kho cho thuốc ${medicine.name}. Chỉ còn ${stockQuantity} ${unit}`;
        }
        return null;
    };

    const handleMedicalRecordSubmit = async (values: any) => {
        try {
            setSavingRecord(true);

            const validPrescriptions = (values.prescriptions || [])
                .filter((p: any) => p && p.medicine_id && p.quantity && p.dosage)
                .map((p: any) => ({ medicine_id: p.medicine_id, quantity: p.quantity, dosage: p.dosage }));

            for (const p of validPrescriptions) {
                const stockError = getStockError(String(p.medicine_id), Number(p.quantity));
                if (stockError) {
                    message.error(stockError);
                    return;
                }
            }

            const medIdCounts: Record<string, number> = {};
            for (const p of validPrescriptions) {
                const mid = String(p.medicine_id);
                medIdCounts[mid] = (medIdCounts[mid] || 0) + 1;
            }
            const duplicateMedId = Object.keys(medIdCounts).find((k) => medIdCounts[k] > 1);
            if (duplicateMedId) {
                message.error("Không được kê trùng cùng một loại thuốc trong cùng một toa");
                return;
            }

            let linkedAppointmentId = "";

            if (editingRecord) {
                // Gửi rõ "" / [] để xóa được điều trị, ghi chú hoặc toàn bộ toa thuốc (backend gộp theo field)
                await updateMedicalRecord(editingRecord._id, {
                    diagnosis: values.diagnosis,
                    treatment: values.treatment ?? "",
                    notes: values.notes ?? "",
                    prescriptions: validPrescriptions,
                });
                linkedAppointmentId = toIdString(editingRecord.appointment_id);
                message.success("Cập nhật hồ sơ y tế thành công!");
            } else {
                const doctorId = toIdString(currentUser?.employee_id) || toIdString(currentUser?._id);
                if (!doctorId) {
                    message.error("Không tìm thấy thông tin bác sĩ. Vui lòng đăng nhập lại.");
                    return;
                }

                const payload: any = {
                    patient_id: patientId,
                    doctor_id: doctorId,
                    diagnosis: values.diagnosis,
                };
                if (values.treatment) payload.treatment = values.treatment;
                if (values.notes) payload.notes = values.notes;
                if (validPrescriptions.length > 0) payload.prescriptions = validPrescriptions;

                let autoLinked: Appointment | null = null;
                if (values.appointment_id) {
                    payload.appointment_id = values.appointment_id;
                } else {
                    autoLinked = pickBestAppointment(appointments, medicalRecords);
                    if (autoLinked) payload.appointment_id = autoLinked._id;
                }

                await createMedicalRecord(payload);
                linkedAppointmentId = payload.appointment_id || "";

                if (autoLinked) {
                    message.success(
                        `Tạo hồ sơ y tế thành công! Đã tự động gắn với lịch hẹn ${dayjs(autoLinked.appointment_date).format("DD/MM/YYYY HH:mm")}`
                    );
                } else if (!linkedAppointmentId) {
                    message.warning(
                        "Đã tạo hồ sơ y tế nhưng chưa gắn lịch hẹn nào. Hồ sơ cần có lịch hẹn mới tạo được hóa đơn."
                    );
                } else {
                    message.success("Tạo hồ sơ y tế thành công!");
                }
            }

            const linkedAppointment = appointments.find((apt) => apt._id === linkedAppointmentId);
            if (linkedAppointmentId && linkedAppointment?.status !== "Completed") {
                try {
                    await updateAppointment(linkedAppointmentId, { status: "Completed" });
                } catch (err) {
                    console.error("Không thể cập nhật trạng thái appointment:", err);
                }
            }

            const records = await getMedicalRecordsByPatientId(patientId);
            setMedicalRecords(records);

            const allAppointments = await getAppointments();
            setAppointments(filterAppointmentsForPatient(allAppointments, patientId));

            setIsMedicalRecordModalVisible(false);
            setEditingRecord(null);
            medicalRecordForm.resetFields();
        } catch (error: any) {
            console.error(error);
            if (error?.status === 403) {
                message.error(error.message || "Bạn không có quyền thao tác hồ sơ y tế này");
            } else {
                message.error(error?.message || "Thao tác thất bại");
            }
        } finally {
            setSavingRecord(false);
        }
    };

    const handleAddMedicalRecord = () => {
        setEditingRecord(null);
        medicalRecordForm.resetFields();
        medicalRecordForm.setFieldsValue({
            prescriptions: [],
        });
        setIsMedicalRecordModalVisible(true);
    };

    const handleEditMedicalRecord = (record: MedicalRecord) => {
        setEditingRecord(record);
        medicalRecordForm.setFieldsValue({
            diagnosis: record.diagnosis,
            treatment: record.treatment,
            notes: record.notes,
            // Không có thuốc thì để trống, không chèn dòng rỗng bắt buộc
            prescriptions: (record.prescriptions || []).map((p: any) => ({
                medicine_id: toIdString(p.medicine_id),
                quantity: p.quantity,
                dosage: p.dosage,
            })),
        });
        setIsMedicalRecordModalVisible(true);
    };

    const refreshInvoices = async () => {
        try {
            const invoiceList = await getInvoicesByPatientId(patientId!);
            setInvoices(invoiceList || []);
        } catch (err) {
            console.error("Error refreshing invoices:", err);
        }
    };

    const handleCreateInvoice = async (medicalRecordId: string) => {
        try {
            setCreatingInvoice(medicalRecordId);
            const invoice = await createInvoiceFromMedicalRecord({ medicalRecordId });

            await refreshInvoices();

            setCreatedInvoice(invoice);
            setInvoiceSuccessModalVisible(true);
        } catch (error: any) {
            console.error(error);
            const errMsg: string = error?.message || "Không thể tạo hóa đơn";
            // invoiceService gắn body lỗi của backend vào error.data
            const shortages: StockShortage[] = Array.isArray(error?.data?.shortages) ? error.data.shortages : [];
            if (shortages.length > 0) {
                Modal.error({
                    title: "Không đủ thuốc trong kho để tạo hóa đơn",
                    content: (
                        <div>
                            <p>{errMsg}</p>
                            <ul className="list-disc pl-5 mt-2">
                                {shortages.map((s, idx) => (
                                    <li key={idx}>
                                        {s.name || "Thuốc"}: cần {s.required ?? "?"}, trong kho còn {s.available ?? 0}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ),
                });
            } else if (error?.data?.invoice_id || errMsg.includes("đã tồn tại") || errMsg.includes("already exists")) {
                message.warning(errMsg);
                await refreshInvoices();
            } else if (error?.status === 403) {
                message.error(errMsg || "Bạn không có quyền tạo hóa đơn");
            } else {
                message.error(errMsg);
            }
        } finally {
            setCreatingInvoice(null);
        }
    };

    const getInvoiceForMedicalRecord = (record: MedicalRecord): Invoice | undefined => {
        const appointmentId = toIdString(record.appointment_id);
        if (!appointmentId) return undefined;
        return invoices.find(inv => toIdString(inv.appointment_id) === appointmentId);
    };

    const handleDeleteMedicalRecord = async (id: string) => {
        try {
            setDeletingRecordId(id);
            await deleteMedicalRecord(id);
            message.success("Xóa hồ sơ y tế thành công!");
            const records = await getMedicalRecordsByPatientId(patientId);
            setMedicalRecords(records);
        } catch (error: any) {
            console.error("Error deleting medical record:", error);
            message.error(error?.message || "Xóa thất bại");
        } finally {
            setDeletingRecordId(null);
        }
    };

    const handlePrintPrescription = (record: MedicalRecord) => {
        try {
            printPrescription(record, patient, formatDateTime);
        } catch (error: any) {
            message.error(error.message || "Không thể mở cửa sổ in. Vui lòng kiểm tra cài đặt trình duyệt.");
        }
    };

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-6">
            <div>
                <Button onClick={() => router.back()} className="mb-4">
                    ← Quay lại
                </Button>
            </div>
            {/* 🔹 Nếu đang ở chế độ XEM THÔNG TIN */}
            {!isEditing && (
                <>
                    <Card
                        title="🩺 Hồ sơ bệnh nhân"
                        variant="borderless"
                        className="shadow-md rounded-2xl"
                        extra={
                            <Button
                                type="primary"
                                onClick={() => setIsEditing(true)}
                                className="bg-blue-600"
                            >
                                Chỉnh sửa
                            </Button>
                        }
                    >
                        <Descriptions bordered column={2} size="middle">
                            <Descriptions.Item label="Mã bệnh nhân">
                                {patient._id}
                            </Descriptions.Item>
                            <Descriptions.Item label="Họ và tên">
                                {patient.fullname}
                            </Descriptions.Item>
                            <Descriptions.Item label="Giới tính">
                                {patient.gender}
                            </Descriptions.Item>
                            <Descriptions.Item label="Ngày sinh">
                                {formatDate(patient.dob)}
                            </Descriptions.Item>
                            <Descriptions.Item label="Số điện thoại">
                                {patient.phone}
                            </Descriptions.Item>
                            <Descriptions.Item label="Email">
                                {patient.email}
                            </Descriptions.Item>
                            <Descriptions.Item label="Địa chỉ" span={2}>
                                {patient.address || "—"}
                            </Descriptions.Item>
                            <Descriptions.Item label="Ngày tạo">
                                {formatDate(patient.created_at)}
                            </Descriptions.Item>
                            <Descriptions.Item label="Cập nhật gần nhất">
                                {formatDate(patient.updated_at)}
                            </Descriptions.Item>
                        </Descriptions>
                    </Card>

                    <Card
                        title="🧾 Tiền sử bệnh"
                        variant="borderless"
                        className="shadow-md rounded-2xl"
                    >
                        {patient.medical_history && patient.medical_history.length > 0 ? (
                            <div className="space-y-3">
                                {patient.medical_history.map((entry: any, index: number) => (
                                    <Card
                                        key={index}
                                        type="inner"
                                        title={`Khoa: ${entry.khoa}`}
                                        className="border-l-4 border-blue-500"
                                    >
                                        <p className="text-gray-700">{entry.description}</p>
                                    </Card>
                                ))}
                            </div>
                        ) : (
                            <Empty description="Chưa có tiền sử bệnh" />
                        )}
                    </Card>

                    <Card
                        title="📋 Hồ sơ y tế"
                        variant="borderless"
                        className="shadow-md rounded-2xl"
                        extra={
                            <Space>
                                {canManageMedicalRecords && (
                                    <Button
                                        type="primary"
                                        icon={<PlusOutlined />}
                                        onClick={handleAddMedicalRecord}
                                        className="bg-green-600"
                                    >
                                        Thêm hồ sơ y tế
                                    </Button>
                                )}
                                {isAdmin && (
                                    <Button
                                        onClick={() => router.push("/dashboard/medical-records/disabled")}
                                    >
                                        Thùng rác
                                    </Button>
                                )}
                            </Space>
                        }
                    >
                        {loadingRecords ? (
                            <div className="flex justify-center py-10">
                                <Spin />
                            </div>
                        ) : medicalRecords.length > 0 ? (
                            <div className="space-y-4">
                                {medicalRecords.map((record) => {
                                    const existingInvoice = getInvoiceForMedicalRecord(record);
                                    const hasPrescriptions = record.prescriptions && record.prescriptions.length > 0;
                                    const hasAppointment = !!toIdString(record.appointment_id);
                                    const canCreateInvoice = hasPrescriptions && hasAppointment;

                                    return (
                                        <Card
                                            key={record._id}
                                            type="inner"
                                            className="border-l-4 border-green-500"
                                        >
                                            <div className="mb-4 flex justify-end gap-2">
                                                {record.prescriptions && record.prescriptions.length > 0 && canPrint && (
                                                    <Button
                                                        type="link"
                                                        icon={<PrinterOutlined />}
                                                        onClick={() => handlePrintPrescription(record)}
                                                    >
                                                        In toa thuốc
                                                    </Button>
                                                )}
                                                {canManageMedicalRecords && canEditRecord(record) && (
                                                    <>
                                                        <Button
                                                            type="link"
                                                            icon={<EditOutlined />}
                                                            onClick={() => handleEditMedicalRecord(record)}
                                                        >
                                                            Sửa
                                                        </Button>
                                                        <Popconfirm
                                                            title="Xác nhận xóa"
                                                            description="Bạn có chắc chắn muốn xóa hồ sơ y tế này?"
                                                            okText="Xóa"
                                                            cancelText="Hủy"
                                                            okButtonProps={{ danger: true }}
                                                            onConfirm={() => handleDeleteMedicalRecord(record._id)}
                                                        >
                                                            <Button
                                                                type="link"
                                                                danger
                                                                icon={<DeleteOutlined />}
                                                                loading={deletingRecordId === record._id}
                                                            >
                                                                Xóa
                                                            </Button>
                                                        </Popconfirm>
                                                    </>
                                                )}
                                                {canCreateInvoiceRole && (
                                                    <Button
                                                        type="link"
                                                        icon={<DollarOutlined />}
                                                        loading={creatingInvoice === record._id}
                                                        disabled={!canCreateInvoice || !!existingInvoice}
                                                        onClick={() => canCreateInvoice && !existingInvoice && handleCreateInvoice(record._id)}
                                                        title={
                                                            existingInvoice
                                                                ? "Hóa đơn đã được tạo"
                                                                : !canCreateInvoice
                                                                    ? (!hasPrescriptions
                                                                        ? "Cần có toa thuốc để tạo hóa đơn"
                                                                        : !hasAppointment
                                                                            ? "Cần có lịch hẹn để tạo hóa đơn"
                                                                            : "Không thể tạo hóa đơn")
                                                                    : "Tạo hóa đơn từ hồ sơ y tế"
                                                        }
                                                    >
                                                        {existingInvoice ? "Đã tạo hóa đơn" : "Tạo Hóa đơn"}
                                                    </Button>
                                                )}
                                            </div>
                                            <Descriptions column={2} size="small">
                                                <Descriptions.Item label="Ngày tạo">
                                                    {formatDateTime(record.created_at)}
                                                </Descriptions.Item>
                                                <Descriptions.Item label="Ngày hẹn">
                                                    {record.appointment_id &&
                                                        typeof record.appointment_id === 'object' &&
                                                        (record.appointment_id as any)?.appointment_date
                                                        ? formatDateTime(
                                                            (record.appointment_id as any).appointment_date
                                                        )
                                                        : "—"}
                                                </Descriptions.Item>
                                                <Descriptions.Item label="Bác sĩ">
                                                    {getRefName(record.doctor_id)}
                                                </Descriptions.Item>
                                                <Descriptions.Item label="Chẩn đoán" span={2}>
                                                    {record.diagnosis}
                                                </Descriptions.Item>
                                                {record.treatment && (
                                                    <Descriptions.Item label="Điều trị" span={2}>
                                                        {record.treatment}
                                                    </Descriptions.Item>
                                                )}
                                                {record.notes && (
                                                    <Descriptions.Item label="Ghi chú" span={2}>
                                                        {record.notes}
                                                    </Descriptions.Item>
                                                )}
                                            </Descriptions>

                                            {record.prescriptions && record.prescriptions.length > 0 && (
                                                <div className="mt-4">
                                                    <h4 className="font-semibold mb-2">Toa thuốc:</h4>
                                                    {(() => {
                                                        const prescriptionData = record.prescriptions.map((p: any, idx: number) => {
                                                            const medicine = typeof p.medicine_id === 'object' ? p.medicine_id : null;
                                                            const price = medicine?.price || 0;
                                                            const quantity = p.quantity || 0;
                                                            const totalPrice = price * quantity;

                                                            return {
                                                                key: idx,
                                                                medicine: medicine?.name || '—',
                                                                unit: medicine?.unit || '—',
                                                                quantity: quantity,
                                                                price: price,
                                                                totalPrice: totalPrice,
                                                                dosage: p.dosage || '—',
                                                            };
                                                        });

                                                        const totalAmount = prescriptionData.reduce((sum: number, item: any) => sum + item.totalPrice, 0);

                                                        return (
                                                            <>
                                                                <Table
                                                                    dataSource={prescriptionData}
                                                                    columns={[
                                                                        {
                                                                            title: "Thuốc",
                                                                            dataIndex: "medicine",
                                                                            key: "medicine",
                                                                            width: '25%'
                                                                        },
                                                                        {
                                                                            title: "Số lượng",
                                                                            dataIndex: "quantity",
                                                                            key: "quantity",
                                                                            width: '10%',
                                                                            align: 'center'
                                                                        },
                                                                        {
                                                                            title: "Đơn vị",
                                                                            dataIndex: "unit",
                                                                            key: "unit",
                                                                            width: '10%',
                                                                            align: 'center'
                                                                        },
                                                                        {
                                                                            title: "Đơn giá",
                                                                            dataIndex: "price",
                                                                            key: "price",
                                                                            width: '15%',
                                                                            align: 'right',
                                                                            render: (price: number) => price > 0
                                                                                ? `${price.toLocaleString('vi-VN')} đ`
                                                                                : '—'
                                                                        },
                                                                        {
                                                                            title: "Liều dùng",
                                                                            dataIndex: "dosage",
                                                                            key: "dosage",
                                                                            width: '25%'
                                                                        },
                                                                    ]}
                                                                    pagination={false}
                                                                    size="small"
                                                                />
                                                                {totalAmount > 0 && (
                                                                    <div className="mt-3 pt-3 border-t border-gray-200">
                                                                        <div className="flex justify-end items-center gap-4">
                                                                            <span className="text-base font-semibold text-gray-700">Tổng tiền toa thuốc:</span>
                                                                            <span className="text-xl font-bold text-blue-600">
                                                                                {totalAmount.toLocaleString('vi-VN')} đ
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </>
                                                        );
                                                    })()}
                                                </div>
                                            )}
                                        </Card>
                                    );
                                })}
                            </div>
                        ) : (
                            <Empty description="Chưa có hồ sơ y tế" />
                        )}
                    </Card>
                </>
            )}

            {/* 🔹 Nếu đang ở chế độ CHỈNH SỬA */}
            {isEditing && (
                <Card
                    title="📝 Chỉnh sửa thông tin bệnh nhân"
                    variant="borderless"
                    className="shadow-md rounded-2xl"
                >
                    <Form
                        form={form}
                        layout="vertical"
                        onFinish={handleUpdate}
                        className="mt-4"
                    >
                        <Row gutter={16}>
                            <Col span={12}>
                                <Form.Item
                                    label="Họ và tên"
                                    name="fullname"
                                    rules={[{ required: true, message: "Vui lòng nhập họ tên" }]}
                                >
                                    <Input placeholder="Nhập họ và tên" />
                                </Form.Item>
                            </Col>

                            <Col span={12}>
                                <Form.Item label="Ngày sinh" name="dob">
                                    <Input type="date" />
                                </Form.Item>
                            </Col>
                        </Row>

                        <Row gutter={16}>
                            <Col span={12}>
                                <Form.Item
                                    label="Giới tính"
                                    name="gender"
                                    rules={[
                                        { required: true, message: "Vui lòng chọn giới tính" },
                                    ]}
                                >
                                    <Select placeholder="Chọn giới tính">
                                        <Select.Option value="Nam">Nam</Select.Option>
                                        <Select.Option value="Nữ">Nữ</Select.Option>
                                    </Select>
                                </Form.Item>
                            </Col>

                            <Col span={12}>
                                <Form.Item label="Số điện thoại" name="phone">
                                    <Input placeholder="Nhập số điện thoại" />
                                </Form.Item>
                            </Col>
                        </Row>

                        <Row gutter={16}>
                            <Col span={12}>
                                <Form.Item label="Email" name="email">
                                    <Input type="email" placeholder="example@email.com" />
                                </Form.Item>
                            </Col>

                            <Col span={12}>
                                <Form.Item label="Địa chỉ" name="address">
                                    <Input placeholder="Nhập địa chỉ" />
                                </Form.Item>
                            </Col>
                        </Row>

                        <div className="flex justify-end gap-3 mt-6">
                            <Button onClick={() => setIsEditing(false)}>Hủy</Button>
                            <Button
                                type="primary"
                                htmlType="submit"
                                loading={saving}
                                className="bg-blue-600"
                            >
                                Cập nhật
                            </Button>
                        </div>
                    </Form>
                </Card>
            )}

            {/* Modal tạo/sửa hồ sơ y tế */}
            <Modal
                title={editingRecord ? "Chỉnh sửa hồ sơ y tế" : "Thêm hồ sơ y tế mới"}
                open={isMedicalRecordModalVisible}
                onCancel={() => {
                    setIsMedicalRecordModalVisible(false);
                    setEditingRecord(null);
                    medicalRecordForm.resetFields();
                }}
                footer={null}
                width={800}
            >
                <Form
                    form={medicalRecordForm}
                    layout="vertical"
                    onFinish={handleMedicalRecordSubmit}
                >
                    {!editingRecord && (
                        <Form.Item
                            label="Lịch hẹn (tự động chọn lịch hẹn gần nhất nếu để trống)"
                            name="appointment_id"
                            help={appointments.length === 0 ? "Chưa có lịch hẹn nào cho bệnh nhân này" : undefined}
                        >
                            <Select
                                placeholder={appointments.length > 0
                                    ? "Chọn lịch hẹn (hoặc để trống để tự động chọn lịch hẹn gần nhất)"
                                    : "Chưa có lịch hẹn"}
                                allowClear
                                disabled={appointments.length === 0}
                                style={{ width: "100%" }}
                            >
                                {appointments
                                    .filter((apt: Appointment) => LINKABLE_APPOINTMENT_STATUSES.includes(apt.status))
                                    .sort((a: Appointment, b: Appointment) => {
                                        const timeA = new Date(a.appointment_date).getTime();
                                        const timeB = new Date(b.appointment_date).getTime();
                                        return timeA - timeB;
                                    })
                                    .map((apt: Appointment) => (
                                        (() => {
                                            const hasMedicalRecord = medicalRecords.some(
                                                (mr: MedicalRecord) => toIdString(mr.appointment_id) === apt._id
                                            );

                                            return (
                                                <Select.Option
                                                    key={apt._id}
                                                    value={apt._id}
                                                    disabled={hasMedicalRecord}
                                                >
                                                    {dayjs(apt.appointment_date).format("DD/MM/YYYY HH:mm")} - {apt.status}
                                                    {hasMedicalRecord ? " (đã có hồ sơ)" : ""}
                                                </Select.Option>
                                            );
                                        })()
                                    ))}
                            </Select>
                        </Form.Item>
                    )}

                    <Form.Item
                        label="Chẩn đoán"
                        name="diagnosis"
                        rules={[{ required: true, message: "Vui lòng nhập chẩn đoán" }]}
                    >
                        <Input.TextArea rows={3} placeholder="Nhập chẩn đoán" />
                    </Form.Item>

                    <Form.Item
                        label="Điều trị"
                        name="treatment"
                    >
                        <Input.TextArea rows={3} placeholder="Nhập phương pháp điều trị" />
                    </Form.Item>

                    <Form.Item
                        label="Ghi chú"
                        name="notes"
                    >
                        <Input.TextArea rows={2} placeholder="Nhập ghi chú (nếu có)" />
                    </Form.Item>

                    <Form.Item>
                        <Form.Item noStyle shouldUpdate={(prevValues, curValues) => {
                            const prevPrescriptions = prevValues.prescriptions || [];
                            const curPrescriptions = curValues.prescriptions || [];
                            if (prevPrescriptions.length !== curPrescriptions.length) return true;
                            return JSON.stringify(prevPrescriptions) !== JSON.stringify(curPrescriptions);
                        }}>
                            {() => {
                                const formValues = medicalRecordForm.getFieldsValue();
                                const allPrescriptions = formValues.prescriptions || [];

                                const totalAmount = allPrescriptions.reduce((sum: number, p: any) => {
                                    if (!p?.medicine_id || !p?.quantity) return sum;
                                    const med = medicines.find(m => m._id === p.medicine_id);
                                    if (!med || !med.price) return sum;
                                    if ((med.total_remaining || 0) <= 0 && !originalQuantities[med._id]) return sum;
                                    return sum + (p.quantity * med.price);
                                }, 0);

                                return (
                                    <Form.List name="prescriptions">
                                        {(fields, { add, remove }) => (
                                            <>
                                                <div className="mb-3">
                                                    <Row gutter={16} className="mb-2 font-semibold text-sm text-gray-700 border-b pb-2">
                                                        <Col span={7}>Thuốc</Col>
                                                        <Col span={2} className="text-center">Đơn vị</Col>
                                                        <Col span={2} className="text-center">Tồn kho</Col>
                                                        <Col span={3} className="text-center">Số lượng</Col>
                                                        <Col span={3} className="text-right">Đơn giá</Col>
                                                        <Col span={5}>Liều dùng</Col>
                                                        <Col span={2} className="text-center">Thao tác</Col>
                                                    </Row>
                                                </div>
                                                {fields.map((field) => {
                                                    const currentPrescription = allPrescriptions[field.name];
                                                    const medicineId = currentPrescription?.medicine_id;
                                                    const quantity = currentPrescription?.quantity;

                                                    const selectedMedicine = medicines.find(m => m._id === medicineId);
                                                    const unit = selectedMedicine?.unit || "—";
                                                    const price = selectedMedicine?.price || 0;
                                                    const stockQuantity = selectedMedicine?.total_remaining || 0;
                                                    const totalPrice = (quantity && price) ? quantity * price : 0;

                                                    return (
                                                        <Form.Item key={field.key} noStyle shouldUpdate={(prevValues, curValues) => {
                                                            const prevPrescriptions = prevValues.prescriptions || [];
                                                            const curPrescriptions = curValues.prescriptions || [];
                                                            if (prevPrescriptions.length !== curPrescriptions.length) return true;
                                                            const prevPrescription = prevPrescriptions[field.name];
                                                            const curPrescription = curPrescriptions[field.name];
                                                            return prevPrescription?.medicine_id !== curPrescription?.medicine_id ||
                                                                prevPrescription?.quantity !== curPrescription?.quantity;
                                                        }}>
                                                            {() => {
                                                                const formValues = medicalRecordForm.getFieldsValue();
                                                                const currentPrescription = formValues.prescriptions?.[field.name];
                                                                const medicineId = currentPrescription?.medicine_id;
                                                                const quantity = currentPrescription?.quantity;

                                                                const selectedMedicine = medicines.find(m => m._id === medicineId);
                                                                const unit = selectedMedicine?.unit || "—";
                                                                const price = selectedMedicine?.price || 0;

                                                                return (
                                                                    <Row gutter={16} className="mb-3" align="middle">
                                                                        <Col span={7}>
                                                                            <Form.Item
                                                                                {...field}
                                                                                name={[field.name, "medicine_id"]}
                                                                                rules={[
                                                                                    { required: true, message: "Chọn thuốc" },
                                                                                    {
                                                                                        validator: async (_rule, value) => {
                                                                                            if (!value) return Promise.resolve();
                                                                                            try {
                                                                                                const formValues = medicalRecordForm.getFieldsValue();
                                                                                                const prescriptions = formValues.prescriptions || [];
                                                                                                const currentValue = String(value);
                                                                                                const occurrences = prescriptions.reduce((acc: number, p: any) => {
                                                                                                    if (!p || !p.medicine_id) return acc;
                                                                                                    return acc + (String(p.medicine_id) === currentValue ? 1 : 0);
                                                                                                }, 0);
                                                                                                if (occurrences > 1) {
                                                                                                    return Promise.reject(new Error("Không được chọn trùng thuốc trong cùng toa"));
                                                                                                }

                                                                                                // Kiểm tra tồn kho (bỏ qua thuốc đã kê sẵn trong hồ sơ đang sửa)
                                                                                                const stockError = getStockError(currentValue);
                                                                                                if (stockError) {
                                                                                                    return Promise.reject(new Error(stockError));
                                                                                                }

                                                                                                return Promise.resolve();
                                                                                            } catch (err) {
                                                                                                return Promise.resolve();
                                                                                            }
                                                                                        }
                                                                                    }
                                                                                ]}
                                                                                className="mb-0"
                                                                            >
                                                                                <Select
                                                                                    placeholder="Chọn thuốc"
                                                                                    showSearch
                                                                                    filterOption={(input, option) =>
                                                                                        (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                                                                                    }
                                                                                    options={medicineOptions}
                                                                                />
                                                                            </Form.Item>
                                                                        </Col>
                                                                        <Col span={2}>
                                                                            <div className="text-center py-2 px-2 bg-gray-50 rounded-md border border-gray-200">
                                                                                <span className="text-sm font-medium text-gray-700">{unit}</span>
                                                                            </div>
                                                                        </Col>
                                                                        <Col span={2}>
                                                                            <div className={`text-center py-2 px-2 rounded-md border ${stockQuantity > 10 ? 'bg-green-50 border-green-200' :
                                                                                stockQuantity > 0 ? 'bg-yellow-50 border-yellow-200' :
                                                                                    'bg-red-50 border-red-200'
                                                                                }`}>
                                                                                <span className={`text-sm font-medium ${stockQuantity > 10 ? 'text-green-700' :
                                                                                    stockQuantity > 0 ? 'text-yellow-700' :
                                                                                        'text-red-700'
                                                                                    }`}>
                                                                                    {stockQuantity}
                                                                                </span>
                                                                            </div>
                                                                        </Col>
                                                                        <Col span={3}>
                                                                            <Form.Item
                                                                                {...field}
                                                                                name={[field.name, "quantity"]}
                                                                                rules={[
                                                                                    { required: true, message: "Nhập số lượng" },
                                                                                    ({ getFieldValue }) => ({
                                                                                        validator(_, value) {
                                                                                            if (!value) return Promise.resolve();
                                                                                            const medicineId = getFieldValue(['prescriptions', field.name, 'medicine_id']);
                                                                                            if (!medicineId) return Promise.resolve();

                                                                                            const stockError = getStockError(String(medicineId), Number(value));
                                                                                            if (stockError) {
                                                                                                return Promise.reject(new Error(stockError));
                                                                                            }

                                                                                            return Promise.resolve();
                                                                                        },
                                                                                    }),
                                                                                ]}
                                                                                className="mb-0"
                                                                            >
                                                                                <InputNumber
                                                                                    placeholder="Số lượng"
                                                                                    min={1}
                                                                                    style={{ width: "100%" }}
                                                                                />
                                                                            </Form.Item>
                                                                        </Col>
                                                                        <Col span={3}>
                                                                            <div className="text-right py-2 px-3 bg-gray-50 rounded-md border border-gray-200">
                                                                                <span className="text-sm font-medium text-gray-700">
                                                                                    {price > 0 ? `${price.toLocaleString('vi-VN')} đ` : "—"}
                                                                                </span>
                                                                            </div>
                                                                        </Col>
                                                                        <Col span={5}>
                                                                            <Form.Item
                                                                                {...field}
                                                                                name={[field.name, "dosage"]}
                                                                                rules={[{ required: true, message: "Nhập liều dùng" }]}
                                                                                className="mb-0"
                                                                            >
                                                                                <Input placeholder="Ví dụ: Sáng 1 viên, tối 1 viên" />
                                                                            </Form.Item>
                                                                        </Col>
                                                                        <Col span={2} className="text-center">
                                                                            <Button
                                                                                type="text"
                                                                                danger
                                                                                onClick={() => remove(field.name)}
                                                                                icon={<DeleteOutlined />}
                                                                                className="text-red-500 hover:text-red-700"
                                                                            />
                                                                        </Col>
                                                                    </Row>
                                                                );
                                                            }}
                                                        </Form.Item>
                                                    );
                                                })}
                                                <div className="mt-4 mb-3">
                                                    <Button
                                                        type="dashed"
                                                        onClick={() => add()}
                                                        block
                                                        icon={<PlusOutlined />}
                                                        className="h-10"
                                                    >
                                                        Thêm thuốc
                                                    </Button>
                                                </div>
                                                {allPrescriptions.length > 0 && (
                                                    <Alert
                                                        message={
                                                            <div className="flex justify-between items-center">
                                                                <span className="font-semibold text-base">Tổng tiền toa thuốc:</span>
                                                                <span className="text-xl font-bold text-blue-600">
                                                                    {totalAmount.toLocaleString('vi-VN')} đ
                                                                </span>
                                                            </div>
                                                        }
                                                        type="info"
                                                        showIcon
                                                        className="mt-3"
                                                    />
                                                )}
                                            </>
                                        )}
                                    </Form.List>
                                );
                            }}
                        </Form.Item>
                    </Form.Item>

                    <div className="flex justify-end gap-3 mt-6">
                        <Button
                            onClick={() => {
                                setIsMedicalRecordModalVisible(false);
                                setEditingRecord(null);
                                medicalRecordForm.resetFields();
                            }}
                        >
                            Hủy
                        </Button>
                        <Button
                            type="primary"
                            htmlType="submit"
                            loading={savingRecord}
                            className="bg-green-600"
                        >
                            {editingRecord ? "Cập nhật" : "Tạo mới"}
                        </Button>
                    </div>
                </Form>
            </Modal>

            {/* Modal thông báo tạo hóa đơn thành công */}
            <Modal
                title="✅ Tạo hóa đơn thành công"
                open={invoiceSuccessModalVisible}
                onCancel={() => {
                    setInvoiceSuccessModalVisible(false);
                    setCreatedInvoice(null);
                }}
                footer={[
                    <Button
                        key="close"
                        type="primary"
                        onClick={() => {
                            setInvoiceSuccessModalVisible(false);
                            setCreatedInvoice(null);
                        }}
                    >
                        Đóng
                    </Button>
                ]}
                width={500}
            >
                <div className="space-y-4">
                    <Alert
                        message="Đã gửi hóa đơn đến quầy thanh toán"
                        description={
                            createdInvoice ? (
                                <div className="mt-2">
                                    <p>Hóa đơn đã được tạo thành công và đã được gửi đến quầy thanh toán.</p>
                                    {createdInvoice.total_amount && (
                                        <p className="mt-2">
                                            <strong>Tổng tiền:</strong>{" "}
                                            {new Intl.NumberFormat("vi-VN", {
                                                style: "currency",
                                                currency: "VND",
                                            }).format(createdInvoice.total_amount)}
                                        </p>
                                    )}
                                </div>
                            ) : (
                                <p>Hóa đơn đã được tạo thành công và đã được gửi đến quầy thanh toán.</p>
                            )
                        }
                        type="success"
                        showIcon
                    />
                </div>
            </Modal>
        </div>
    );
}
