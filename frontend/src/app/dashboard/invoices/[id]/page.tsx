"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    Button,
    Form,
    Spin,
    message,
    Card,
    Row,
    Col,
    Descriptions,
    Table,
    Space,
    Modal,
    InputNumber,
    Select,
    DatePicker,
    Tag,
    Typography,
    Divider,
    Empty,
    QRCode,
    Popconfirm,
} from "antd";
import { PlusOutlined, DeleteOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import {
    getInvoiceById,
    updateInvoiceStatus,
    Invoice,
} from "@/lib/services/invoiceService";
import {
    getPaymentsByInvoiceId,
    createPayment,
    deletePayment,
    createVNPayUrl,
    createVNPayQR,
    Payment,
} from "@/lib/services/paymentService";

const { Title, Text } = Typography;
const { Option } = Select;

// TỰ VIẾT
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
// 

export default function InvoiceDetailPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const [paymentForm] = Form.useForm();
    const [invoice, setInvoice] = useState<Invoice | null>(null);
    const [payments, setPayments] = useState<Payment[]>([]);
    // `loading` chỉ dùng cho lần tải đầu; làm mới nền dùng `refreshing` để không thay cả trang bằng spinner
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [isPaymentModalVisible, setIsPaymentModalVisible] = useState(false);
    const [creatingPayment, setCreatingPayment] = useState(false);
    const [processingVNPay, setProcessingVNPay] = useState(false);
    const [processingQR, setProcessingQR] = useState(false);
    const [qrCodeData, setQrCodeData] = useState<string>("");
    const [isQRModalVisible, setIsQRModalVisible] = useState(false);
    const [updatingStatus, setUpdatingStatus] = useState(false);
    const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null);
    const [role, setRole] = useState<string>("");
    // Số thanh toán lúc mở QR, để polling biết khi nào có thanh toán mới
    const qrBaselineCountRef = useRef<number>(0);
    const paymentNoticeHandledRef = useRef(false);
    const pendingPaymentRefreshRef = useRef(false);

    // TỰ VIẾT
    useEffect(() => {
        const fetchRole = async () => {
            try {
                const res = await fetch("/api/session", { cache: "no-store" });
                const data = await res.json();
                const r = (data?.user?.role || "").toLowerCase();
                setRole(r);
                if (r && r !== "admin" && r !== "accountant") {
                    message.warning("Bạn không có quyền truy cập trang này");
                    router.push("/dashboard/invoices");
                }
            } catch {
                router.push("/auth/login");
            }
        };
        fetchRole();
    }, []);

    // silent: dùng cho polling/làm mới nền — chỉ log lỗi, không bắn thông báo mỗi lần
    const fetchInvoice = useCallback(async (silent = false): Promise<Invoice | null> => {
        if (!id) return null;
        try {
            const data = await getInvoiceById(id);
            setInvoice(data);
            return data;
        } catch (error: any) {
            console.error(error);
            if (!silent) message.error(error.message || "Không thể tải thông tin hóa đơn");
            return null;
        }
    }, [id]);

    const fetchPayments = useCallback(async (silent = false): Promise<Payment[] | null> => {
        if (!id) return null;
        try {
            const data = await getPaymentsByInvoiceId(id);
            setPayments(data);
            return data;
        } catch (error: any) {
            console.error(error);
            if (!silent) message.error(error.message || "Không thể tải danh sách thanh toán");
            return null;
        }
    }, [id]);

    const refreshAll = useCallback(async (silent = false) => {
        setRefreshing(true);
        try {
            await Promise.all([fetchInvoice(silent), fetchPayments(silent)]);
        } finally {
            setRefreshing(false);
        }
    }, [fetchInvoice, fetchPayments]);
    //

    // Lần tải đầu (và khi đổi id)
    useEffect(() => {
        if (!id) return;
        let cancelled = false;
        setLoading(true);
        Promise.all([fetchInvoice(), fetchPayments()]).finally(() => {
            if (!cancelled) setLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [id, fetchInvoice, fetchPayments]);

    // Kết quả VNPay: backend /api/payments/vnpay-return chỉ kiểm tra chữ ký rồi chuyển về đây với ?payment=success|failed.
    // Thanh toán chỉ được ghi nhận qua IPN (có thể đến muộn hơn) nên ngoài lần tải đầu, tải lại thêm một lần sau vài giây.
    useEffect(() => {
        if (!id) return;
        if (!paymentNoticeHandledRef.current) {
            const params = new URLSearchParams(window.location.search);
            const paymentResult = params.get("payment");
            const hasRawVNPayParams = Array.from(params.keys()).some((key) => key.startsWith("vnp_"));
            if (!paymentResult && !hasRawVNPayParams) return;
            paymentNoticeHandledRef.current = true;
            pendingPaymentRefreshRef.current = true;

            if (paymentResult === "success") {
                message.success("VNPay báo thanh toán thành công. Hóa đơn sẽ được cập nhật khi giao dịch được xác nhận.");
            } else if (paymentResult) {
                message.error("Thanh toán VNPay không thành công hoặc đã bị hủy.");
            } else {
                // Tham số vnp_* chưa qua backend xác thực chữ ký: không coi là thành công
                message.info("Đã nhận phản hồi từ VNPay, đang chờ hệ thống xác nhận giao dịch.");
            }

            // Xóa tham số khỏi URL để tải lại trang không hiện lại thông báo
            ["payment", "message"].forEach((key) => params.delete(key));
            Array.from(params.keys())
                .filter((key) => key.startsWith("vnp_"))
                .forEach((key) => params.delete(key));
            const qs = params.toString();
            window.history.replaceState(window.history.state, "", window.location.pathname + (qs ? `?${qs}` : ""));
        }

        if (!pendingPaymentRefreshRef.current) return;
        const timer = window.setTimeout(() => {
            pendingPaymentRefreshRef.current = false;
            refreshAll(true);
        }, 5000);
        return () => window.clearTimeout(timer);
    }, [id, refreshAll]);

    // Khi mở QR: kiểm tra mỗi 3 giây, so sánh với dữ liệu vừa tải (không đọc state cũ trong closure)
    useEffect(() => {
        if (!isQRModalVisible) return;

        let stopped = false;
        let inFlight = false;
        const baseline = qrBaselineCountRef.current;

        const timer = window.setInterval(async () => {
            if (stopped || inFlight) return;
            inFlight = true;
            try {
                const [latestInvoice, latestPayments] = await Promise.all([
                    fetchInvoice(true),
                    fetchPayments(true),
                ]);
                if (stopped) return;
                const paidNow =
                    (latestPayments !== null && latestPayments.length > baseline) ||
                    latestInvoice?.status === "Paid";
                if (paidNow) {
                    stopped = true;
                    window.clearInterval(timer);
                    setIsQRModalVisible(false);
                    setQrCodeData("");
                    message.success("Thanh toán đã được ghi nhận");
                }
            } finally {
                inFlight = false;
            }
        }, 3000);

        return () => {
            stopped = true;
            window.clearInterval(timer);
        };
    }, [isQRModalVisible, fetchInvoice, fetchPayments]);

    const handleCreatePayment = async (values: any) => {
        if (!id) return;

        if (values.method === 'VNPay') {
            setIsPaymentModalVisible(false);
            paymentForm.resetFields();
            await handleVNPayPayment();
            return;
        }

        if (values.method === 'VNPayQR') {
            setIsPaymentModalVisible(false);
            paymentForm.resetFields();
            await handleVNPayQRPayment();
            return;
        }

        try {
            setCreatingPayment(true);
            await createPayment({
                invoice_id: id,
                method: values.method,
                amount: values.amount,
                date: values.date.format("YYYY-MM-DD"),
            });
            message.success("Tạo thanh toán thành công");
            setIsPaymentModalVisible(false);
            paymentForm.resetFields();
            await refreshAll();
        } catch (error: any) {
            // Backend trả thông báo cụ thể (vd: vượt quá số tiền còn lại)
            message.error(error.message || "Không thể tạo thanh toán");
        } finally {
            setCreatingPayment(false);
        }
    };

    // TỰ VIẾT
    const handleDeletePayment = async (paymentId: string) => {
        try {
            setDeletingPaymentId(paymentId);
            await deletePayment(paymentId);
            message.success("Xóa thanh toán thành công");
            await refreshAll();
        } catch (error: any) {
            message.error(error.message || "Không thể xóa thanh toán");
        } finally {
            setDeletingPaymentId(null);
        }
    };

    // Backend tự tính lại trạng thái từ các khoản thanh toán; lấy kết quả trả về để cập nhật giao diện
    const handleUpdateStatus = async () => {
        if (!id) return;
        try {
            setUpdatingStatus(true);
            const updated = await updateInvoiceStatus(id);
            // Response của PUT không populate bệnh nhân/lịch hẹn nên chỉ ghép các trường tính toán
            setInvoice((prev) =>
                prev
                    ? {
                        ...prev,
                        status: updated?.status ?? prev.status,
                        total_amount: updated?.total_amount ?? prev.total_amount,
                        updated_at: updated?.updated_at ?? prev.updated_at,
                    }
                    : prev
            );
            await fetchPayments(true);
            message.success("Cập nhật trạng thái thành công");
        } catch (error: any) {
            message.error(error.message || "Không thể cập nhật trạng thái");
        } finally {
            setUpdatingStatus(false);
        }
    };
    //

    const handleVNPayPayment = async () => {
        if (!id) return;
        try {
            setProcessingVNPay(true);
            const result = await createVNPayUrl({ invoice_id: id });
            if (result.paymentUrl) {
                window.location.href = result.paymentUrl;
            } else {
                throw new Error('Không nhận được payment URL từ server');
            }
        } catch (error: any) {
            console.error(' Lỗi khi tạo VNPay URL:', error);
            message.error(error.message || "Không thể tạo URL thanh toán VNPay");
            setProcessingVNPay(false);
        }
    };

    const handleVNPayQRPayment = async () => {
        if (!id) return;
        try {
            setProcessingQR(true);
            const result = await createVNPayQR({ invoice_id: id });
            if (result.paymentUrl) {
                // Ghi nhận số thanh toán hiện tại trước khi mở QR để polling so sánh
                qrBaselineCountRef.current = payments.length;
                setQrCodeData(result.paymentUrl);
                setIsQRModalVisible(true);
            } else {
                throw new Error('Không nhận được payment URL từ server');
            }
        } catch (error: any) {
            console.error(' Lỗi khi tạo VNPay QR:', error);
            message.error(error.message || "Không thể tạo QR code VNPay");
        } finally {
            setProcessingQR(false);
        }
    };

    const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const remaining = (invoice?.total_amount || 0) - totalPaid;

    const paymentColumns = [
        {
            title: "Ngày thanh toán",
            dataIndex: "date",
            key: "date",
            render: (date: string) => dayjs(date).format("DD/MM/YYYY"),
        },
        {
            title: "Phương thức",
            dataIndex: "method",
            key: "method",
        },
        {
            title: "Số tiền",
            dataIndex: "amount",
            key: "amount",
            render: (amount: number) => (
                <Text strong>{amount?.toLocaleString("vi-VN")} đ</Text>
            ),
        },
        {
            title: "Thao tác",
            key: "action",
            render: (_: any, record: Payment) => (
                role === "admin" && (
                    <Popconfirm
                        title="Xóa thanh toán"
                        description={`Xóa khoản thanh toán ${record.amount?.toLocaleString("vi-VN")} đ? Trạng thái hóa đơn sẽ được tính lại.`}
                        onConfirm={() => handleDeletePayment(record._id)}
                        okText="Xóa"
                        cancelText="Hủy"
                        okButtonProps={{ danger: true }}
                    >
                        <Button
                            type="link"
                            danger
                            icon={<DeleteOutlined />}
                            loading={deletingPaymentId === record._id}
                        >
                            Xóa
                        </Button>
                    </Popconfirm>
                )
            ),
        },
    ];

    if (loading) {
        return (
            <div style={{ padding: "24px", textAlign: "center" }}>
                <Spin size="large" />
            </div>
        );
    }

    if (!invoice) {
        return (
            <div style={{ padding: "24px" }}>
                <Card>
                    <Empty description="Không tìm thấy hóa đơn" />
                </Card>
            </div>
        );
    }

    const patient = typeof invoice.patient_id === 'object' && invoice.patient_id !== null
        ? invoice.patient_id
        : null;

    const appointment = typeof invoice.appointment_id === 'object' && invoice.appointment_id !== null
        ? invoice.appointment_id
        : null;


    return (
        <div style={{ padding: "24px" }}>
            <Space style={{ marginBottom: "16px" }}>
                <Button onClick={() => router.push("/dashboard/invoices")}>
                    ← Quay lại
                </Button>
            </Space>

            <Title level={2}>Chi tiết Hóa đơn</Title>

            <Row gutter={[16, 16]}>
                <Col xs={24} lg={16}>
                    <Card title="Thông tin Hóa đơn" style={{ marginBottom: "16px" }}>
                        <Descriptions column={1} bordered>
                            <Descriptions.Item label="Mã hóa đơn">
                                <Text copyable={{ text: invoice._id }}>{invoice._id}</Text>
                            </Descriptions.Item>
                            <Descriptions.Item label="Bệnh nhân">
                                {patient?.fullname || "N/A"}
                            </Descriptions.Item>
                            <Descriptions.Item label="Ngày khám">
                                {appointment?.appointment_date
                                    ? dayjs(appointment.appointment_date).format("DD/MM/YYYY")
                                    : "N/A"}
                            </Descriptions.Item>
                            <Descriptions.Item label="Tổng tiền">
                                <Text strong style={{ fontSize: "18px", color: "#1890ff" }}>
                                    {invoice.total_amount?.toLocaleString("vi-VN")} đ
                                </Text>
                            </Descriptions.Item>
                            <Descriptions.Item label="Đã thanh toán">
                                <Text strong style={{ fontSize: "16px", color: "#52c41a" }}>
                                    {totalPaid.toLocaleString("vi-VN")} đ
                                </Text>
                            </Descriptions.Item>
                            <Descriptions.Item label="Còn lại">
                                <Text strong style={{ fontSize: "16px", color: remaining > 0 ? "#ff4d4f" : "#52c41a" }}>
                                    {remaining.toLocaleString("vi-VN")} đ
                                </Text>
                            </Descriptions.Item>
                            <Descriptions.Item label="Trạng thái">
                                <Tag color={getStatusColor(invoice.status)}>
                                    {getStatusText(invoice.status)}
                                </Tag>
                            </Descriptions.Item>
                            <Descriptions.Item label="Ngày tạo">
                                {dayjs(invoice.created_at).format("DD/MM/YYYY HH:mm")}
                            </Descriptions.Item>
                        </Descriptions>
                    </Card>

                    <Card
                        title="Lịch sử Thanh toán"
                        extra={
                            (role === "admin" || role === "accountant") && (
                                <Button
                                    type="primary"
                                    icon={<PlusOutlined />}
                                    onClick={() => setIsPaymentModalVisible(true)}
                                    disabled={remaining <= 0}
                                >
                                    Thanh toán
                                </Button>
                            )
                        }
                    >
                        <Table
                            columns={paymentColumns}
                            dataSource={payments}
                            rowKey="_id"
                            loading={refreshing}
                            pagination={false}
                            locale={{ emptyText: "Chưa có thanh toán nào" }}
                        />
                    </Card>
                </Col>

                <Col xs={24} lg={8}>
                    <Card title="Tóm tắt">
                        <Space direction="vertical" style={{ width: "100%" }} size="large">
                            <div>
                                <Text type="secondary">Tổng tiền:</Text>
                                <br />
                                <Title level={4} style={{ margin: 0 }}>
                                    {invoice.total_amount?.toLocaleString("vi-VN")} đ
                                </Title>
                            </div>
                            <Divider />
                            <div>
                                <Text type="secondary">Đã thanh toán:</Text>
                                <br />
                                <Title level={4} style={{ margin: 0, color: "#52c41a" }}>
                                    {totalPaid.toLocaleString("vi-VN")} đ
                                </Title>
                            </div>
                            <Divider />
                            <div>
                                <Text type="secondary">Còn lại:</Text>
                                <br />
                                <Title level={4} style={{ margin: 0, color: remaining > 0 ? "#ff4d4f" : "#52c41a" }}>
                                    {remaining.toLocaleString("vi-VN")} đ
                                </Title>
                            </div>
                            <Divider />
                            {(role === "admin" || role === "accountant") && (
                                <Button
                                    type="default"
                                    block
                                    onClick={handleUpdateStatus}
                                    loading={updatingStatus}
                                >
                                    Cập nhật trạng thái
                                </Button>
                            )}
                        </Space>
                    </Card>
                </Col>
            </Row>

            <Modal
                title="Thêm Thanh toán"
                open={isPaymentModalVisible}
                onCancel={() => {
                    setIsPaymentModalVisible(false);
                    paymentForm.resetFields();
                }}
                footer={null}
            >
                <Form
                    form={paymentForm}
                    layout="vertical"
                    onFinish={handleCreatePayment}
                >
                    <Form.Item
                        name="method"
                        label="Phương thức thanh toán"
                        rules={[{ required: true, message: "Vui lòng chọn phương thức" }]}
                    >
                        <Select
                            placeholder="Chọn phương thức"
                            onChange={(value) => {
                                if (value === 'VNPay' || value === 'VNPayQR') {
                                    paymentForm.setFieldsValue({ amount: remaining, date: dayjs() });
                                }
                            }}
                        >
                            <Option value="VNPay" disabled>VNPay (Web) - Đang bảo trì</Option>
                            <Option value="VNPayQR" disabled>VNPay (QR Code) - Đang bảo trì</Option>
                            <Option value="Cash">Tiền mặt</Option>
                        </Select>
                    </Form.Item>

                    <Form.Item
                        noStyle
                        shouldUpdate={(prevValues, currentValues) => prevValues.method !== currentValues.method}
                    >
                        {({ getFieldValue }) => {
                            const method = getFieldValue('method');
                            if (method !== 'Cash') {
                                return null;
                            }
                            return (
                                <>
                                    <Form.Item
                                        name="amount"
                                        label="Số tiền"
                                        rules={[
                                            { required: true, message: "Vui lòng nhập số tiền" },
                                            {
                                                type: "number",
                                                min: 1,
                                                message: "Số tiền phải lớn hơn 0",
                                            },
                                            {
                                                validator: (_, value) => {
                                                    if (value && value > remaining) {
                                                        return Promise.reject(
                                                            new Error(`Số tiền không được vượt quá ${remaining.toLocaleString("vi-VN")} đ`)
                                                        );
                                                    }
                                                    return Promise.resolve();
                                                },
                                            },
                                        ]}
                                    >
                                        <InputNumber
                                            style={{ width: "100%" }}
                                            formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                            parser={(value) => {
                                                const parsed = value!.replace(/\$\s?|(,*)/g, '');
                                                return parsed ? Number(parsed) : 0;
                                            }}
                                            placeholder="Nhập số tiền"
                                            max={remaining}
                                        />
                                    </Form.Item>

                                    <Form.Item
                                        name="date"
                                        label="Ngày thanh toán"
                                        rules={[{ required: true, message: "Vui lòng chọn ngày" }]}
                                        initialValue={dayjs()}
                                    >
                                        <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
                                    </Form.Item>
                                </>
                            );
                        }}
                    </Form.Item>

                    <Form.Item>
                        <Space>
                            <Button
                                type="primary"
                                htmlType="submit"
                                loading={creatingPayment}
                            >
                                Tạo thanh toán
                            </Button>
                            <Button
                                onClick={() => {
                                    setIsPaymentModalVisible(false);
                                    paymentForm.resetFields();
                                }}
                            >
                                Hủy
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Modal>

            {/* QR Code Modal */}
            <Modal
                title="Thanh toán VNPay bằng QR Code"
                open={isQRModalVisible}
                onCancel={() => {
                    setIsQRModalVisible(false);
                    setQrCodeData("");
                }}
                footer={[
                    <Button
                        key="close"
                        onClick={() => {
                            setIsQRModalVisible(false);
                            setQrCodeData("");
                        }}
                    >
                        Đóng
                    </Button>,
                ]}
                width={400}
            >
                <div style={{ textAlign: "center", padding: "20px 0" }}>
                    <Space direction="vertical" size="large">
                        <div>
                            <Text strong>Quét mã QR để thanh toán</Text>
                            <br />
                            <Text type="secondary">
                                Sử dụng ứng dụng ngân hàng hoặc VNPay để quét mã
                            </Text>
                        </div>

                        {qrCodeData && (
                            <QRCode
                                value={qrCodeData}
                                size={256}
                                icon="/logo_phong_kham.png"
                                errorLevel="M"
                            />
                        )}

                        <div>
                            <Text type="secondary" style={{ fontSize: "12px" }}>
                                QR code có hiệu lực trong 15 phút
                            </Text>
                        </div>
                    </Space>
                </div>
            </Modal>
        </div>
    );
}

