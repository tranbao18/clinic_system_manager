"use client";

import { useState, useEffect } from "react";
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
  Spin,
} from "antd";
import dayjs, { Dayjs } from "dayjs";
import { useRouter } from "next/navigation";
import PayrollService, { CreatePayrollData } from "@/lib/services/payrollService";
import EmployeesService from "@/lib/services/employeesService";

const { Content } = Layout;
const { Option } = Select;

interface Employee {
  _id: string;
  fullname: string;
  position: string;
  basic_salary?: number;
}

// TỰ VIẾT
export default function NewPayrollPage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const router = useRouter();

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

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        setLoadingEmployees(true);
        const data = await EmployeesService.getAll();
        setEmployees(data.filter((e: any) => !e.disabled));
      } catch (error: any) {
        message.error("Không thể tải danh sách nhân viên");
      } finally {
        setLoadingEmployees(false);
      }
    };
    fetchEmployees();
  }, []);

  const handleEmployeeChange = (employeeId: string) => {
    const selectedEmployee = employees.find((emp) => emp._id === employeeId);
    if (selectedEmployee && (selectedEmployee as any).basic_salary) {
      form.setFieldsValue({
        basic_salary: (selectedEmployee as any).basic_salary,
      });
      calculateNetSalary();
    }
  };

  const calculateNetSalary = () => {
    const basicSalary = form.getFieldValue("basic_salary") || 0;
    const bonus = form.getFieldValue("bonus") || 0;
    const deductions = form.getFieldValue("deductions") || 0;
    const netSalary = basicSalary + bonus - deductions;
    form.setFieldsValue({ net_salary: netSalary });
  };

  const onFinish = async (values: any) => {
    try {
      setLoading(true);

      const payload: CreatePayrollData = {
        employee_id: values.employee_id,
        basic_salary: values.basic_salary,
        bonus: values.bonus || 0,
        deductions: values.deductions || 0,
        net_salary: values.net_salary || (values.basic_salary + (values.bonus || 0) - (values.deductions || 0)),
        paydate: dayjs(values.paydate).toISOString(),
      };

      await PayrollService.create(payload);
      message.success("Tạo bảng lương thành công!");
      router.push("/dashboard/payroll");
    } catch (error: any) {
      message.error(error.message || "Lỗi khi tạo bảng lương");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Content className="p-8">
        <Card title="Tạo Bảng lương mới" className="max-w-2xl mx-auto shadow">
          <Spin spinning={loadingEmployees}>
            <Form
              form={form}
              layout="vertical"
              onFinish={onFinish}
              initialValues={{
                bonus: 0,
                deductions: 0,
                paydate: dayjs(),
              }}
            >
              <Form.Item
                label="Nhân viên"
                name="employee_id"
                rules={[{ required: true, message: "Chọn nhân viên" }]}
              >
                <Select
                  placeholder="Chọn nhân viên"
                  showSearch
                  filterOption={(input, option) =>
                    (option?.children as unknown as string)
                      ?.toLowerCase()
                      .includes(input.toLowerCase())
                  }
                  onChange={handleEmployeeChange}
                >
                  {employees.map((emp) => (
                    <Option key={emp._id} value={emp._id}>
                      {emp.fullname} - {emp.position}
                    </Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item
                label="Lương cơ bản"
                name="basic_salary"
                rules={[
                  { required: true, message: "Nhập lương cơ bản" },
                  { type: "number", min: 0, message: "Lương cơ bản phải >= 0" },
                ]}
              >
                <InputNumber
                  style={{ width: "100%" }}
                  formatter={(value) =>
                    `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                  }
                  parser={(value) => value!.replace(/\$\s?|(,*)/g, "")}
                  onChange={calculateNetSalary}
                  placeholder="Nhập lương cơ bản"
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
                rules={[{ required: true, message: "Lương thực nhận là bắt buộc" }]}
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
                label="Ngày thanh toán"
                name="paydate"
                rules={[{ required: true, message: "Chọn ngày thanh toán" }]}
              >
                <DatePicker
                  style={{ width: "100%" }}
                  format="DD/MM/YYYY"
                  placeholder="Chọn ngày thanh toán"
                />
              </Form.Item>

              <Form.Item>
                <div className="flex justify-end gap-2">
                  <Button onClick={() => router.back()}>Hủy</Button>
                  <Button type="primary" htmlType="submit" loading={loading}>
                    Tạo bảng lương
                  </Button>
                </div>
              </Form.Item>
            </Form>
          </Spin>
        </Card>
      </Content>
    </Layout>
  );
}
//

