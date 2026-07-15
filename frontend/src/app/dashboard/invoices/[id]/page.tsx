"use client";

import { useEffect, useState, useRef } from "react";
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
} from "antd";
import { PlusOutlined, DeleteOutlined, DollarOutlined, QrcodeOutlined } from "@ant-design/icons";
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
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5050";

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
    const [loading, setLoading] = useState(true);
    const [loadingPayments, setLoadingPayments] = useState(false);
    const [isPaymentModalVisible, setIsPaymentModalVisible] = useState(false);
    const [creatingPayment, setCreatingPayment] = useState(false);
    const [processingVNPay, setProcessingVNPay] = useState(false);
    const [processingQR, setProcessingQR] = useState(false);
    const [qrCodeData, setQrCodeData] = useState<string>("");
    const [isQRModalVisible, setIsQRModalVisible] = useState(false);
    const [role, setRole] = useState<string>("");
    const pollRef = useRef<number | null>(null);
    const prevPaymentsCountRef = useRef<number>(0);

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

    const fetchInvoice = async () => {
        if (!id) return;
        try {
            setLoading(true);
            const data = await getInvoiceById(id);
            setInvoice(data);
        } catch (error: any) {
            console.error(error);
            message.error(error.message || "Không thể tải thông tin hóa đơn");
        } finally {
            setLoading(false);
        }
    };

    const fetchPayments = async () => {
        if (!id) return;
        try {
            setLoadingPayments(true);
            const data = await getPaymentsByInvoiceId(id);
            setPayments(data);
        } catch (error: any) {
            console.error(error);
            message.error(error.message || "Không thể tải danh sách thanh toán");
        } finally {
            setLoadingPayments(false);
        }
    };
    // 

    useEffect(() => {
        fetchInvoice();
        fetchPayments();

        const urlParams = new URLSearchParams(window.location.search);
        const paymentResult = urlParams.get('payment');

        const hasVNPayParams = urlParams.has('vnp_ResponseCode') || urlParams.has('vnp_TxnRef');

        if (hasVNPayParams && !paymentResult) {
            const vnpParams = new URLSearchParams();
            urlParams.forEach((value, key) => {
                if (key.startsWith('vnp_')) {
                    vnpParams.append(key, value);
                }
            });

            const invoiceId = urlParams.get('vnp_TxnRef') || id;
            if (invoiceId) {
                // redirect to backend return handler (note: backend route is /api/payments/vnpay-return)
                window.location.href = `/api/payments/vnpay-return?${vnpParams.toString()}`;
                return;
            }
        }

        if (paymentResult === 'success') {
            message.success('Thanh toán VNPay thành công!');
            fetchInvoice();
            fetchPayments();
            window.history.replaceState({}, '', window.location.pathname);
        } else if (paymentResult === 'failed') {
            const errorMsg = urlParams.get('message') || 'Thanh toán thất bại';
            message.error(errorMsg);
            window.history.replaceState({}, '', window.location.pathname);
        }
    }, [id]);

    // Poll when QR modal is open to detect payment created by mobile redirect/mock
    useEffect(() => {
        if (!isQRModalVisible) {
            if (pollRef.current) {
                window.clearInterval(pollRef.current);
                pollRef.current = null;
            }
            return;
        }

        // start polling every 3s
        const idInterval = window.setInterval(async () => {
            try {
                await fetchPayments();
                await fetchInvoice();
                // if number of payments increased or invoice status changed, close modal and notify
                const currentCount = payments.length;
                if (currentCount > prevPaymentsCountRef.current || (invoice && invoice.status === 'Paid')) {
                    message.success('Thanh toán đã được xử lý, đang cập nhật giao diện...');
                    setIsQRModalVisible(false);
                    if (pollRef.current) {
                        window.clearInterval(pollRef.current);
                        pollRef.current = null;
                    }
                    // refresh data once more
                    await fetchPayments();
                    await fetchInvoice();
                }
            } catch (err) {
                console.error('Polling error:', err);
            }
        }, 3000);

        pollRef.current = idInterval as unknown as number;

        return () => {
            if (pollRef.current) {
                window.clearInterval(pollRef.current);
                pollRef.current = null;
            }
        };
    }, [isQRModalVisible, payments.length, invoice?.status]);

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
            await fetchPayments();
            await fetchInvoice();
        } catch (error: any) {
            message.error(error.message || "Không thể tạo thanh toán");
        } finally {
            setCreatingPayment(false);
        }
    };

    // TỰ VIẾT
    const handleDeletePayment = async (paymentId: string) => {
        try {
            await deletePayment(paymentId);
            message.success("Xóa thanh toán thành công");
            await fetchPayments();
            await fetchInvoice();
        } catch (error: any) {
            message.error(error.message || "Không thể xóa thanh toán");
        }
    };

    const handleUpdateStatus = async () => {
        if (!id) return;
        try {
            await updateInvoiceStatus(id);
            message.success("Cập nhật trạng thái thành công");
            await fetchInvoice();
        } catch (error: any) {
            message.error(error.message || "Không thể cập nhật trạng thái");
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
                setQrCodeData(result.paymentUrl);
                setIsQRModalVisible(true);
                // initialize previous payments count
                prevPaymentsCountRef.current = payments.length;
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
                    <Button
                        type="link"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => handleDeletePayment(record._id)}
                    >
                        Xóa
                    </Button>
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
                            loading={loadingPayments}
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

                        <div style={{ marginTop: 12 }}>
                            <Button
                                type="dashed"
                                onClick={() => {
                                    // Create a dev mock URL that calls backend mock return directly
                                    const mockUrl = `${BACKEND_URL}/api/payments/vnpay-mock-return?invoice_id=${id}&amount=${remaining}&__enable_mock=true`;
                                    setQrCodeData(mockUrl);
                                    message.info("Mock QR đã được tạo (dev). Quét để kích hoạt mock return.");
                                }}
                            >
                                Tạo Mock QR (dev)
                            </Button>
                        </div>

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

