"use client";

import { useState, useEffect } from "react";
import {
  Form,
  Input,
  Button,
  DatePicker,
  message,
  Layout,
  Card,
  InputNumber,
  Spin,
  Descriptions,
  Switch,
  Tag,
} from "antd";
import dayjs, { Dayjs } from "dayjs";
import { useParams, useRouter } from "next/navigation";
import PayrollService, { Payroll, UpdatePayrollData } from "@/lib/services/payrollService";

const { Content } = Layout;

export default function PayrollDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [payroll, setPayroll] = useState<Payroll | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [sendEmail, setSendEmail] = useState(true);

  useEffect(() => {
    const fetchRole = async () => {
      try {
        const res = await fetch("/api/session", { cache: "no-store" });
        const data = await res.json();
        const r = (data?.user?.role || "").toLowerCase();
        if (r && r !== "admin" && r !== "accountant") {
          message.warning("Bạn không có quyền truy cập trang này");
          router.push("/dashboard/payroll");
        }
      } catch {
        router.push("/auth/login");
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

  // TỰ VIẾT
  useEffect(() => {
    const fetchPayroll = async () => {
      try {
        setLoading(true);
        const data = await PayrollService.getById(id as string);
        setPayroll(data);

        form.setFieldsValue({
          basic_salary: data.basic_salary,
          bonus: data.bonus || 0,
          deductions: data.deductions || 0,
          net_salary: data.net_salary,
          paydate: dayjs(data.paydate),
        });
      } catch (error: any) {
        message.error("Không thể tải thông tin bảng lương: " + error.message);
        router.push("/dashboard/payroll");
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchPayroll();
  }, [id, form, router]);
  // 

  const calculateNetSalary = () => {
    const basicSalary = form.getFieldValue("basic_salary") || 0;
    const bonus = form.getFieldValue("bonus") || 0;
    const deductions = form.getFieldValue("deductions") || 0;
    const netSalary = basicSalary + bonus - deductions;
    form.setFieldsValue({ net_salary: netSalary });
  };

  const handleSave = async (values: any) => {
    try {
      setSaving(true);

      const basicSalaryValue = form.getFieldValue("basic_salary") ?? (payroll?.basic_salary ?? 0);
      const bonusValue = values.bonus ?? form.getFieldValue("bonus") ?? (payroll?.bonus ?? 0);
      const deductionsValue = values.deductions ?? form.getFieldValue("deductions") ?? (payroll?.deductions ?? 0);
      const computedNetSalary = basicSalaryValue + bonusValue - deductionsValue;

      const payload: UpdatePayrollData = {
        basic_salary: basicSalaryValue,
        bonus: bonusValue,
        deductions: deductionsValue,
        net_salary: computedNetSalary,
      };

      const result = await PayrollService.update(id as string, payload, sendEmail);

      if (result.emailSent) {
        message.success("Cập nhật lương thành công và đã gửi email cho nhân viên!");
      } else if (result.emailError) {
        message.warning(
          `Cập nhật lương thành công nhưng không thể gửi email: ${result.emailError}`
        );
      } else {
        message.success("Cập nhật lương thành công!");
      }

      setEditMode(false);
      const updated = await PayrollService.getById(id as string);
      setPayroll(updated);
      form.setFieldsValue({
        basic_salary: updated.basic_salary,
        bonus: updated.bonus || 0,
        deductions: updated.deductions || 0,
        net_salary: updated.net_salary,
        paydate: dayjs(updated.paydate),
      });
    } catch (error: any) {
      message.error("Lỗi khi cập nhật bảng lương: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  // TỰ VIẾT
  const getEmployeeName = () => {
    if (!payroll) return "N/A";
    if (typeof payroll.employee_id === "object" && payroll.employee_id) {
      return payroll.employee_id.fullname || "N/A";
    }
    return "N/A";
  };

  const getEmployeeEmail = () => {
    if (!payroll) return "N/A";
    if (typeof payroll.employee_id === "object" && payroll.employee_id) {
      return payroll.employee_id.email || "N/A";
    }
    return "N/A";
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[80vh]">
        <Spin size="large" />
      </div>
    );
  }

  if (!payroll) {
    return (
      <div className="flex justify-center items-center h-[80vh] text-gray-500">
        Không tìm thấy thông tin bảng lương
      </div>
    );
  }

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Content className="m-4 p-4 bg-white rounded shadow">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold">Chi tiết Bảng lương</h2>
          <div className="flex gap-2">
            <Button onClick={() => router.push("/dashboard/payroll")}>
              Quay lại
            </Button>
            {!editMode ? (
              <Button type="primary" onClick={() => setEditMode(true)}>
                Chỉnh sửa
              </Button>
            ) : (
              <Button onClick={() => setEditMode(false)}>Hủy</Button>
            )}
          </div>
        </div>

        <Card title="Thông tin nhân viên" className="mb-6">
          <Descriptions bordered column={2} size="middle">
            <Descriptions.Item label="Tên nhân viên">
              {getEmployeeName()}
            </Descriptions.Item>
            <Descriptions.Item label="Email">
              {getEmployeeEmail()}
            </Descriptions.Item>
          </Descriptions>
        </Card>

        <Card title="Thông tin lương">
          <div style={{ display: !editMode ? "block" : "none" }}>
            <Descriptions bordered column={2} size="middle">
              <Descriptions.Item label="Lương cơ bản">
                <strong>{formatCurrency(payroll.basic_salary)} đ</strong>
              </Descriptions.Item>
              <Descriptions.Item label="Thưởng">
                {formatCurrency(payroll.bonus || 0)} đ
              </Descriptions.Item>
              <Descriptions.Item label="Khấu trừ">
                {formatCurrency(payroll.deductions || 0)} đ
              </Descriptions.Item>
              <Descriptions.Item label="Lương thực nhận">
                <strong style={{ color: "#2563eb", fontSize: "18px" }}>
                  {formatCurrency(payroll.net_salary)} đ
                </strong>
              </Descriptions.Item>
              <Descriptions.Item label="Ngày tạo">
                {formatDate(payroll.paydate)}
              </Descriptions.Item>
              <Descriptions.Item label="Trạng thái email">
                {payroll.emailSent ? (
                  <Tag color="green">Đã gửi email</Tag>
                ) : (
                  <Tag color="default">Chưa gửi email</Tag>
                )}
              </Descriptions.Item>
            </Descriptions>
          </div>

          <Form
            form={form}
            layout="vertical"
            onFinish={handleSave}
            style={{ display: editMode ? "block" : "none" }}
          >
            <Form.Item
              label="Lương cơ bản"
              name="basic_salary"
            >
              <InputNumber
                style={{ width: "100%" }}
                formatter={(value) =>
                  `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                }
                parser={(value) => value!.replace(/\$\s?|(,*)/g, "")}
                readOnly
                className="bg-gray-50"
              />
            </Form.Item>

            <Form.Item
              label="Thưởng"
              name="bonus"
              rules={[{ type: "number", min: 0, message: "Thưởng phải >= 0" }]}
            >
              <InputNumber
                style={{ width: "100%" }}
                formatter={(value) =>
                  `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                }
                parser={(value) => value!.replace(/\$\s?|(,*)/g, "")}
                onChange={calculateNetSalary}
                placeholder="Nhập thưởng (nếu có)"
              />
            </Form.Item>

            <Form.Item
              label="Khấu trừ"
              name="deductions"
              rules={[{ type: "number", min: 0, message: "Khấu trừ phải >= 0" }]}
            >
              <InputNumber
                style={{ width: "100%" }}
                formatter={(value) =>
                  `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                }
                parser={(value) => value!.replace(/\$\s?|(,*)/g, "")}
                onChange={calculateNetSalary}
                placeholder="Nhập khấu trừ (nếu có)"
              />
            </Form.Item>

            <Form.Item
              label="Lương thực nhận"
              name="net_salary"
            >
              <InputNumber
                style={{ width: "100%" }}
                formatter={(value) =>
                  `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                }
                parser={(value) => value!.replace(/\$\s?|(,*)/g, "")}
                readOnly
                className="bg-gray-50"
              />
            </Form.Item>

            <Form.Item
              label="Gửi email cho nhân viên sau khi cập nhật"
              valuePropName="checked"
            >
              <Switch
                checked={sendEmail}
                onChange={setSendEmail}
                checkedChildren="Có"
                unCheckedChildren="Không"
              />
            </Form.Item>

            <div className="text-right">
              <Button onClick={() => setEditMode(false)} className="mr-2">
                Hủy
              </Button>
              <Button type="primary" htmlType="submit" loading={saving}>
                Lưu thay đổi
              </Button>
            </div>
          </Form>
        </Card>
      </Content>
    </Layout>
  );
  // 
}

