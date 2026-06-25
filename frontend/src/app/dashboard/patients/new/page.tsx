"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Input,
  Button,
  Form,
  message,
  Card,
  Select,
  DatePicker,
  Space,
} from "antd";
import dayjs from "dayjs";
import { PlusOutlined, MinusCircleOutlined } from "@ant-design/icons";
import { createPatient, Patient } from "@/lib/services/patientsService";

// TỰ VIẾT
export default function AddPatientPage() {
  const router = useRouter();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [role, setRole] = useState<string>("");

  useEffect(() => {
    const fetchRole = async () => {
      try {
        const res = await fetch("/api/session", { cache: "no-store" });
        const data = await res.json();
        const r = (data?.user?.role || "").toLowerCase();
        setRole(r);
        if (r && r !== "receptionist") {
          router.push("/dashboard/patients");
        }
      } catch {
        router.push("/auth/login");
      }
    };
    fetchRole();
  }, []);

  const specializations = [
    "Nội tổng hợp",
    "Nhi khoa",
    "Da liễu",
    "Tim mạch",
    "Chấn thương chỉnh hình",
    "Tai mũi họng",
  ];

  const handleAddPatient = async (values: any) => {
    try {
      setSaving(true);

      const formattedValues: Partial<Patient> = {
        fullname: values.fullname,
        dob: values.dob ? values.dob.toISOString() : null,
        gender: values.gender,
        address: values.address,
        phone: values.phone,
        email: values.email,
        medical_history: values.medical_history || [],
      };

      await createPatient(formattedValues);
      message.success("Thêm bệnh nhân thành công!");
      router.push("/dashboard/patients");
    } catch (error) {
      console.error(error);
      message.error("Không thể thêm bệnh nhân");
    } finally {
      setSaving(false);
    }
  };


  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Card
        title="🩺 Thêm bệnh nhân mới"
        className="shadow-md rounded-2xl"
        bordered={false}
      >
        <Form
          layout="vertical"
          form={form}
          onFinish={handleAddPatient}
          initialValues={{
            fullname: "",
            dob: null,
            gender: "",
            address: "",
            phone: "",
            email: "",
            medical_history: [],
          }}
        >
          <Form.Item
            label="Họ và tên"
            name="fullname"
            rules={[{ required: true, message: "Vui lòng nhập họ tên" }]}
          >
            <Input placeholder="VD: Phan Thanh Tùng" />
          </Form.Item>

          <div className="grid grid-cols-2 gap-4">
            <Form.Item
              label="Ngày sinh"
              name="dob"
              rules={[{ required: true, message: "Vui lòng chọn ngày sinh" }]}
            >
              <DatePicker
                className="w-full"
                format="YYYY-MM-DD"
                placeholder="2000-01-01"
              />
            </Form.Item>

            <Form.Item
              label="Giới tính"
              name="gender"
              initialValue="Nam"
              rules={[{ required: true, message: "Vui lòng chọn giới tính" }]}
            >
              <Select placeholder="Chọn giới tính">
                <Select.Option value="Male">Nam</Select.Option>
                <Select.Option value="Female">Nữ</Select.Option>
              </Select>
            </Form.Item>
          </div>

          <Form.Item
            label="Địa chỉ"
            name="address"
            rules={[{ required: true, message: "Vui lòng nhập địa chỉ" }]}
          >
            <Input placeholder="VD: 12 Nguyễn Huệ, TP.HCM" />
          </Form.Item>

          <div className="grid grid-cols-2 gap-4">
            <Form.Item
              label="Số điện thoại"
              name="phone"
              rules={[
                { required: true, message: "Vui lòng nhập số điện thoại" },
                {
                  pattern: /^[0-9]{9,11}$/,
                  message: "Số điện thoại không hợp lệ",
                },
              ]}
            >
              <Input placeholder="VD: 0909555123" />
            </Form.Item>

            <Form.Item
              label="Email"
              name="email"
              rules={[{ type: "email", message: "Email không hợp lệ" }]}
            >
              <Input placeholder="VD: tung.phan@gmail.com" />
            </Form.Item>
          </div>

          <Form.List name="medical_history">
            {(fields, { add, remove }) => (
              <>
                <label className="block font-medium mb-2">
                  🩹 Tiền sử bệnh
                </label>
                {fields.map(({ key, name, ...restField }) => (
                  <Space
                    key={key}
                    style={{
                      display: "flex",
                      marginBottom: 8,
                      alignItems: "baseline",
                    }}
                    align="baseline"
                  >
                    <Form.Item
                      {...restField}
                      name={[name, "khoa"]}
                      rules={[
                        {
                          required: true,
                          message: "Vui lòng chọn chuyên khoa",
                        },
                      ]}
                    >
                      <Select
                        placeholder="Chọn chuyên khoa"
                        className="min-w-[180px]"
                      >
                        {specializations.map((spec) => (
                          <Select.Option key={spec} value={spec}>
                            {spec}
                          </Select.Option>
                        ))}
                      </Select>
                    </Form.Item>
                    <Form.Item
                      {...restField}
                      name={[name, "description"]}
                      rules={[{ required: true, message: "Nhập mô tả bệnh" }]}
                    >
                      <Input placeholder="VD: Tăng huyết áp nhẹ" />
                    </Form.Item>
                    <MinusCircleOutlined
                      onClick={() => remove(name)}
                      className="text-red-500 text-lg cursor-pointer"
                    />
                  </Space>
                ))}
                <Form.Item>
                  <Button
                    type="dashed"
                    onClick={() => add()}
                    block
                    icon={<PlusOutlined />}
                  >
                    Thêm tiền sử bệnh
                  </Button>
                </Form.Item>
              </>
            )}
          </Form.List>

          <div className="flex justify-end gap-3 mt-6">
            <Button onClick={() => router.back()}>Hủy</Button>
            <Button type="primary" htmlType="submit" loading={saving}>
              Thêm bệnh nhân
            </Button>
          </div>
        </Form>
      </Card>
    </div>
  );
}
// 
