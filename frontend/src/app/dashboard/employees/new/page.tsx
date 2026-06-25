"use client";

import { useState } from "react";
import {
  Form,
  Input,
  Button,
  Select,
  DatePicker,
  message,
  Layout,
  Card,
  InputNumber,
} from "antd";
import dayjs from "dayjs";
import { useRouter } from "next/navigation";
import AuthService from "@/lib/services/authService";
import EmployeesService from "@/lib/services/employeesService";

const { Content } = Layout;

export default function NewEmployeePage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [position, setPosition] = useState<string>("");
  const router = useRouter();

  const positions = ["Bác sĩ", "Y tá", "Lễ tân", "Kế toán", "Dược sĩ", "Admin"];

  const specializations = [
    "Nội tổng hợp",
    "Nhi khoa",
    "Da liễu",
    "Tim mạch",
    "Chấn thương chỉnh hình",
    "Tai mũi họng",
  ];

  // TỰ VIẾT
  const mapGenderToApiValue = (gender: string) => {
    if (gender === "Nam") return "Male";
    if (gender === "Nữ") return "Female";
    return gender;
  };
  //

  // TỰ VIẾT
  function mapPositionToRole(position: string) {
    const mapping: Record<string, string> = {
      "Bác sĩ": "Doctor",
      "Y tá": "Nurse",
      "Lễ tân": "Receptionist",
      "Kế toán": "Accountant",
      "Dược sĩ": "Pharmacist",
      Admin: "Admin",
    };
    return mapping[position] || "Receptionist";
  }
  // 
  // TỰ VIẾT
  const validateEmailDuplicate = async (email: string) => {
    try {
      const response = await EmployeesService.getAll();
      const employees = response.data || response;
      const emailExists = employees.some(
        (employee: any) => employee.email?.toLowerCase() === email.toLowerCase()
      );

      if (emailExists) {
        throw new Error("Email này đã được sử dụng bởi nhân viên khác");
      }
    } catch (error: any) {
      console.error("Email validation error:", error);
      if (error.message.includes("đã được sử dụng")) {
        throw error;
      }
      console.warn("Không thể kiểm tra email trùng lặp:", error.message);
    }
  };
  //

  const onFinish = async (values: any) => {
    try {
      setLoading(true);

      if (values.email && values.email.trim()) {
        await validateEmailDuplicate(values.email.trim());
      }

      const role = mapPositionToRole(values.position);

      const accountPayload = {
        role,
        employee: {
          fullname: values.fullname,
          dob: values.dob ? dayjs(values.dob).toISOString() : null,
          gender: mapGenderToApiValue(values.gender),
          phone: values.phone,
          email: values.email,
          position: values.position,
          specialization: values.specialization || "",
          basic_salary: values.basic_salary || 0,
        },
      };

      const accountRes = await AuthService.registerAccountForEmployee(
        accountPayload.role,
        accountPayload.employee
      );

      if (!accountRes?.user?._id) {
        throw new Error("Không nhận được ID người dùng sau khi tạo tài khoản");
      }

      const employeeEmail = values.email;
      const hasEmail = employeeEmail && employeeEmail.trim() !== "";

      if (hasEmail) {
        message.success({
          content: (
            <>
              <div style={{ marginBottom: "8px" }}>
                🎉 Nhân viên & tài khoản đã được tạo thành công!
              </div>
              <div style={{ marginBottom: "8px", color: "#52c41a", fontWeight: "bold" }}>
                📧 Email chứa thông tin tài khoản đã được gửi đến: <strong>{employeeEmail}</strong>
              </div>
              <div style={{ marginTop: "8px", fontSize: "12px", color: "#666" }}>
                <strong>Thông tin tài khoản (dự phòng):</strong> <br />
                Username: <strong>{accountRes.user.username}</strong> <br />
                Password: <strong>{accountRes.user.generated_password}</strong>
              </div>
            </>
          ),
          duration: 10, // Hiển thị trong 10 giây
        });
      } else {
        message.success({
          content: (
            <>
              <div style={{ marginBottom: "8px" }}>
                🎉 Nhân viên & tài khoản đã được tạo thành công!
              </div>
              <div style={{ marginTop: "8px" }}>
                <strong>Thông tin tài khoản:</strong> <br />
                Username: <strong>{accountRes.user.username}</strong> <br />
                Password: <strong>{accountRes.user.generated_password}</strong>
              </div>
              <div style={{ marginTop: "8px", fontSize: "12px", color: "#faad14" }}>
                ⚠️ Lưu ý: Nhân viên không có email, vui lòng cung cấp thông tin tài khoản trực tiếp.
              </div>
            </>
          ),
          duration: 10,
        });
      }

      router.push("/dashboard/employees");
    } catch (error: any) {
      console.error("❌ Error:", error);
      const errMsg = (error && error.message) || String(error || "");

      if (
        errMsg.includes("Email này đã được sử dụng") ||
        errMsg.includes("duplicate key") ||
        errMsg.includes("E11000") ||
        errMsg.toLowerCase().includes("email")
      ) {
        try {
          form.setFields([
            {
              name: "email",
              errors: ["Email này đã được sử dụng bởi nhân viên khác"],
            },
          ]);
        } catch (setErr) {
          console.warn("Không thể set field error:", setErr);
        }
        message.error("Email đã tồn tại. Vui lòng sử dụng email khác.");
      } else {
        message.error(errMsg || "Lỗi khi tạo nhân viên");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Content className="p-8">
        <Card title="Thêm Nhân viên mới" className="max-w-2xl mx-auto shadow">
          <Form
            form={form}
            layout="vertical"
            onFinish={onFinish}
            initialValues={{ gender: "Nam" }}
          >
            <Form.Item
              label="Họ tên"
              name="fullname"
              rules={[{ required: true, message: "Vui lòng nhập họ tên" }]}
            >
              <Input placeholder="Nhập họ tên nhân viên" />
            </Form.Item>

            <Form.Item label="Ngày sinh" name="dob">
              <DatePicker
                style={{ width: "100%" }}
                format="DD/MM/YYYY"
                placeholder="Chọn ngày sinh"
              />
            </Form.Item>

            <Form.Item
              label="Giới tính"
              name="gender"
              rules={[{ required: true, message: "Vui lòng chọn giới tính" }]}
            >
              <Select
                options={[
                  { label: "Nam", value: "Nam" },
                  { label: "Nữ", value: "Nữ" },
                ]}
              />
            </Form.Item>

            <Form.Item
              label="Số điện thoại"
              name="phone"
              rules={[
                { required: true, message: "Vui lòng nhập số điện thoại" },
                { pattern: /^0\d{9}$/, message: "Số điện thoại không hợp lệ" },
              ]}
            >
              <Input placeholder="VD: 0909123456" />
            </Form.Item>

            <Form.Item
              label="Email"
              name="email"
              rules={[
                { required: true, message: "Vui lòng nhập email" },
                { type: "email", message: "Email không hợp lệ" },
                {
                  validator: async (_, value) => {
                    if (value && value.trim()) {
                      await validateEmailDuplicate(value.trim());
                    }
                  },
                },
              ]}
              extra="📧 Email này sẽ nhận thông tin tài khoản (username và password) sau khi tạo nhân viên"
            >
              <Input placeholder="VD: name@clinic.com" />
            </Form.Item>

            <Form.Item
              label="Chức vụ"
              name="position"
              rules={[{ required: true, message: "Vui lòng chọn chức vụ" }]}
            >
              <Select
                placeholder="Chọn chức vụ"
                options={positions.map((p) => ({ label: p, value: p }))}
                onChange={(value) => setPosition(value)}
              />
            </Form.Item>

            {position === "Bác sĩ" && (
              <Form.Item
                label="Chuyên khoa"
                name="specialization"
                dependencies={["position"]}
                rules={[
                  ({ getFieldValue }) => ({
                    required: getFieldValue("position") === "Bác sĩ",
                    message: "Vui lòng chọn chuyên khoa",
                  }),
                ]}
                hidden={form.getFieldValue("position") !== "Bác sĩ"}
              >
                <Select
                  options={specializations.map((s) => ({ label: s, value: s }))}
                />
              </Form.Item>
            )}

            <Form.Item
              label="Lương cơ bản"
              name="basic_salary"
              rules={[
                { required: true, message: "Vui lòng nhập lương cơ bản" },
                { type: "number", min: 0, message: "Lương cơ bản phải >= 0" },
              ]}
            >
              <InputNumber
                style={{ width: "100%" }}
                formatter={(value) =>
                  `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                }
                parser={(value) => value!.replace(/\$\s?|(,*)/g, "") as any}
                placeholder="Nhập lương cơ bản"
                min={0}
              />
            </Form.Item>

            <Form.Item>
              <div className="flex justify-end gap-4">
                <Button onClick={() => router.push("/dashboard/employees")}>
                  Hủy
                </Button>
                <Button type="primary" htmlType="submit" loading={loading}>
                  Lưu nhân viên
                </Button>
              </div>
            </Form.Item>
          </Form>
        </Card>
      </Content>
    </Layout>
  );
}
