
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Layout,
  Card,
  Descriptions,
  Button,
  Spin,
  message,
  Form,
  Input,
  Select,
  DatePicker,
  Modal,
  InputNumber,
} from "antd";
import EmployeesService from "@/lib/services/employeesService";
import AuthService from "@/lib/services/authService";
import PayrollService, { Payroll } from "@/lib/services/payrollService";
import dayjs, { Dayjs } from "dayjs";

const { Content } = Layout;
const { Option } = Select;

interface Employee {
  _id: string;
  fullname: string;
  gender: string;
  phone: string;
  email: string;
  position: string;
  specialization?: string;
  address?: string;
  dob?: string;
  basic_salary?: number;
  created_at: string;
}

interface UserAccount {
  _id?: string;
  id?: string;
  username: string;
  password_hash: string;
  created_at: string;
  role?: string;
}

interface ChangePasswordFormValues {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export default function EmployeeDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [account, setAccount] = useState<UserAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [form] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [changingPassword, setChangingPassword] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] =
    useState(false);
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
  const [payrollHistory, setPayrollHistory] = useState<Payroll[]>([]);
  const [loadingPayroll, setLoadingPayroll] = useState(false);

  // TỰ VIẾT
  const formattedDate = (dateString?: string) => {
    if (!dateString) return "-";
    const d = new Date(dateString);
    return `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1)
      .toString()
      .padStart(2, "0")}/${d.getFullYear()}`;
  };

  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        // Get user data from sessionStorage instead of API to maintain per-tab sessions
        const userData = sessionStorage.getItem("user") || localStorage.getItem("user");
        if (userData) {
          const data = JSON.parse(userData);
          setCurrentUser(data);
        }
      } catch (error) {
        console.error("Không thể tải user hiện tại:", error);
      }
    };

    fetchCurrentUser();
  }, []);

  const mapGenderDisplay = (gender?: string) => {
    if (!gender) return "-";
    if (gender === "Male") return "Nam";
    if (gender === "Female") return "Nữ";
    return gender;
  };
  // 

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        const empData = await EmployeesService.getById(id as string);
        setEmployee(empData);

        const data = await AuthService.getEmployeeById(id as string);
        console.log("📦 Account data from API:", data);
        console.log("📦 User object:", data?.user);
        setAccount(data?.user || null);

        form.setFieldsValue({
          fullname: empData.fullname,
          gender: empData.gender,
          dob: empData.date_of_birth || empData.dob ? dayjs(empData.date_of_birth || empData.dob) : null,
          position: empData.position,
          specialization: empData.specialization,
          phone: empData.phone,
          email: empData.email,
          address: empData.address,
          basic_salary: empData.basic_salary,
        });

        try {
          setLoadingPayroll(true);
          const payrolls = await PayrollService.getByEmployeeId(id as string);
          payrolls.sort((a: Payroll, b: Payroll) =>
            new Date(b.paydate).getTime() - new Date(a.paydate).getTime()
          );
          setPayrollHistory(payrolls);
        } catch (err) {
          console.error("Lỗi khi tải lịch sử lương:", err);
        } finally {
          setLoadingPayroll(false);
        }
      } catch {
        message.error("Không thể tải dữ liệu nhân viên hoặc tài khoản");
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchData();
  }, [id, form]);

  const isAdmin = (currentUser?.role || "").toLowerCase() === "admin";
  const canChangePassword = !!account && isAdmin;
  const canResetPassword = !!account && isAdmin;

  // TỰ VIẾT
  useEffect(() => {
    const accountId = account?._id || account?.id;

  }, [account, currentUser, isAdmin, canResetPassword]);
  // 
  const handleSave = async (values: {
    fullname: string;
    gender: string;
    email: string;
    phone?: string;
    address?: string;
    dob?: Dayjs | null;
    position?: string;
    specialization?: string;
    basic_salary?: number;
  }) => {
    try {
      setSaving(true);
      if (!employee?._id) return;

      const payload = {
        ...values,
        dob: values.dob ? dayjs(values.dob).toISOString() : undefined,
      };

      await EmployeesService.updateEmployee(employee._id, payload);
      message.success("Cập nhật thông tin nhân viên thành công!");
      setEmployee({ ...employee, ...payload });
      setEditMode(false);
    } catch {
      message.error("Không thể cập nhật thông tin nhân viên");
    } finally {
      setSaving(false);
    }
  };


  const handleChangePasswordSubmit = async (
    values: ChangePasswordFormValues
  ) => {
    if (!accountId) return;
    if (values.newPassword !== values.confirmPassword) {
      message.error("Mật khẩu mới và xác nhận không khớp");
      return;
    }
    try {
      setChangingPassword(true);
      await AuthService.changePassword(accountId, {
        oldPassword: values.oldPassword,
        newPassword: values.newPassword,
      });
      message.success("Đổi mật khẩu thành công");
      passwordForm.resetFields();
      setIsChangePasswordModalOpen(false);
    } catch (error: any) {
      message.error(error.message || "Không thể đổi mật khẩu");
    } finally {
      setChangingPassword(false);
    }
  };

  const accountId = account?._id || account?.id;

  const handleResetPassword = async () => {
    if (!accountId) {
      console.error("No accountId found");
      message.error("Không tìm thấy tài khoản để reset");
      return;
    }

    try {
      setResettingPassword(true);
      const result = await AuthService.resetPassword(accountId);
      message.success(
        result.message || "Reset mật khẩu thành công. Mật khẩu mới đã được gửi qua email."
      );
      setIsResetPasswordModalOpen(false);
    } catch (error: any) {
      console.error("Reset password error:", error);
      const errorMessage = error.message || "Không thể reset mật khẩu";
      message.error(errorMessage);
    } finally {
      setResettingPassword(false);
    }
  };

  const confirmResetPassword = () => {

    if (!accountId) {
      console.error(" No accountId found");
      message.error("Không tìm thấy tài khoản để reset");
      return;
    }
    setIsResetPasswordModalOpen(true);
  };

  if (!employee && !loading)
    return (
      <div className="flex justify-center items-center h-[80vh] text-gray-500">
        Không tìm thấy thông tin nhân viên
      </div>
    );
  // TỰ VIẾT
  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Content className="m-4 p-4 bg-white rounded shadow relative">
        {(loading || saving) && (
          <div className="absolute inset-0 bg-white/60 flex justify-center items-center z-50">
            <Spin size="large" />
          </div>
        )}

        <div
          className={`transition-opacity duration-300 ${loading ? "opacity-50" : "opacity-100"
            }`}
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-bold">Chi tiết Nhân viên</h2>
            <div className="flex gap-2">
              <Button onClick={() => router.push("/dashboard/employees")}>
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
            <div style={{ display: !editMode ? "block" : "none" }}>
              <Descriptions bordered column={2} size="middle">
                <Descriptions.Item label="Họ và tên">
                  {employee?.fullname}
                </Descriptions.Item>
                <Descriptions.Item label="Giới tính">
                  {mapGenderDisplay(employee?.gender)}
                </Descriptions.Item>

                <Descriptions.Item label="Chức vụ">
                  {employee?.position}
                </Descriptions.Item>
                <Descriptions.Item label="Chuyên môn">
                  {employee?.specialization || "-"}
                </Descriptions.Item>
                <Descriptions.Item label="Email">
                  {employee?.email}
                </Descriptions.Item>
                <Descriptions.Item label="Số điện thoại">
                  {employee?.phone}
                </Descriptions.Item>
                <Descriptions.Item label="Ngày sinh">
                  {employee?.dob ? formattedDate(employee.dob) : "-"}
                </Descriptions.Item>
                <Descriptions.Item label="Lương cơ bản">
                  {employee?.basic_salary ? employee.basic_salary.toLocaleString("vi-VN") + " đ" : "-"}
                </Descriptions.Item>
                <Descriptions.Item label="Địa chỉ">
                  {employee?.address || "-"}
                </Descriptions.Item>
              </Descriptions>

              <Descriptions bordered column={1} size="middle" className="mt-4">
                <Descriptions.Item label="Ngày tạo hồ sơ">
                  {formattedDate(employee?.created_at)}
                </Descriptions.Item>
              </Descriptions>
            </div>

            <Form
              form={form}
              layout="vertical"
              onFinish={handleSave}
              style={{ display: editMode ? "block" : "none" }}
            >
              <div className="grid grid-cols-2 gap-4">
                <Form.Item
                  label="Họ và tên"
                  name="fullname"
                  rules={[{ required: true, message: "Nhập họ tên" }]}
                >
                  <Input />
                </Form.Item>
                <Form.Item
                  label="Giới tính"
                  name="gender"
                  rules={[{ required: true }]}
                >
                  <Select>
                    <Option value="Nam">Nam</Option>
                    <Option value="Nữ">Nữ</Option>
                    <Option value="Khác">Khác</Option>
                  </Select>
                </Form.Item>
                <Form.Item label="Chức vụ" name="position">
                  <Input disabled />
                </Form.Item>
                <Form.Item label="Chuyên môn" name="specialization">
                  <Input disabled />
                </Form.Item>
                <Form.Item
                  label="Email"
                  name="email"
                  rules={[
                    { required: true },
                    { type: "email", message: "Email không hợp lệ" },
                  ]}
                >
                  <Input />
                </Form.Item>
                <Form.Item label="Số điện thoại" name="phone">
                  <Input />
                </Form.Item>
                <Form.Item label="Ngày sinh" name="dob">
                  <DatePicker
                    style={{ width: "100%" }}
                    format="DD/MM/YYYY"
                    placeholder="Chọn ngày sinh"
                  />
                </Form.Item>
                <Form.Item
                  label="Địa chỉ"
                  name="address"
                >
                  <Input.TextArea />
                </Form.Item>
                <Form.Item
                  label="Lương cơ bản"
                  name="basic_salary"
                  rules={[
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
              </div>

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

          <Card title="Thông tin tài khoản đăng nhập">
            {account ? (
              <Descriptions bordered size="middle" column={2}>
                <Descriptions.Item label="Tên đăng nhập">
                  {account.username}
                </Descriptions.Item>
                <Descriptions.Item label="Vai trò">
                  {account.role || "-"}
                </Descriptions.Item>
              </Descriptions>
            ) : (
              <div className="text-gray-500">
                Nhân viên này chưa có tài khoản.
              </div>
            )}
          </Card>

          {(canChangePassword || canResetPassword) && (
            <Card title="Quản lý mật khẩu" className="mt-6">
              {canChangePassword && (
                <>
                  <p className="text-gray-600 mb-3">
                    Chỉ chủ tài khoản hoặc Admin mới có thể đổi mật khẩu tại đây.
                  </p>
                  <Button type="primary" onClick={() => setIsChangePasswordModalOpen(true)}>
                    Đổi mật khẩu
                  </Button>
                  <Modal
                    title="Đổi mật khẩu"
                    open={isChangePasswordModalOpen}
                    onCancel={() => {
                      setIsChangePasswordModalOpen(false);
                      passwordForm.resetFields();
                    }}
                    footer={null}
                    destroyOnHidden
                  >
                    <Form
                      form={passwordForm}
                      layout="vertical"
                      onFinish={handleChangePasswordSubmit}
                    >
                      <Form.Item
                        label="Mật khẩu hiện tại"
                        name="oldPassword"
                        rules={[
                          { required: true, message: "Nhập mật khẩu hiện tại" },
                        ]}
                      >
                        <Input.Password placeholder="Nhập mật khẩu hiện tại" />
                      </Form.Item>
                      <Form.Item
                        label="Mật khẩu mới"
                        name="newPassword"
                        rules={[
                          { required: true, message: "Nhập mật khẩu mới" },
                          { min: 6, message: "Mật khẩu cần ít nhất 6 ký tự" },
                        ]}
                      >
                        <Input.Password placeholder="Nhập mật khẩu mới" />
                      </Form.Item>
                      <Form.Item
                        label="Xác nhận mật khẩu mới"
                        name="confirmPassword"
                        dependencies={["newPassword"]}
                        rules={[
                          { required: true, message: "Xác nhận mật khẩu mới" },
                        ]}
                      >
                        <Input.Password placeholder="Nhập lại mật khẩu mới" />
                      </Form.Item>
                      <div className="text-right">
                        <Button
                          onClick={() => {
                            setIsChangePasswordModalOpen(false);
                            passwordForm.resetFields();
                          }}
                          className="mr-2"
                        >
                          Hủy
                        </Button>
                        <Button
                          type="primary"
                          htmlType="submit"
                          loading={changingPassword}
                        >
                          Xác nhận
                        </Button>
                      </div>
                    </Form>
                  </Modal>
                </>
              )}

              {canResetPassword && (
                <div className={canChangePassword ? "mt-6" : ""}>
                  <p className="text-gray-600 mb-3">
                    Chỉ dùng khi nhân viên quên mật khẩu và không thể đăng nhập.
                    Mật khẩu mới sẽ được gửi qua email của nhân viên.
                  </p>
                  <Button
                    danger
                    onClick={() => {
                      console.log("🟣 Reset password button clicked");
                      confirmResetPassword();
                    }}
                    loading={resettingPassword}
                  >
                    Reset mật khẩu
                  </Button>
                  <Modal
                    title="Reset mật khẩu nhân viên?"
                    open={isResetPasswordModalOpen}
                    onOk={handleResetPassword}
                    onCancel={() => {
                      console.log("🟡 Reset password modal cancelled");
                      setIsResetPasswordModalOpen(false);
                    }}
                    okText="Reset mật khẩu"
                    cancelText="Hủy"
                    okButtonProps={{ danger: true }}
                    confirmLoading={resettingPassword}
                  >
                    <p>
                      Hệ thống sẽ tạo mật khẩu mới và gửi email đến nhân viên. Tiếp tục?
                    </p>
                  </Modal>
                </div>
              )}
            </Card>
          )}

          <Card title="Lịch sử lương" className="mt-6">
            <Spin spinning={loadingPayroll}>
              {payrollHistory.length === 0 ? (
                <div className="text-gray-500 text-center py-4">
                  Nhân viên này chưa có lịch sử lương.
                </div>
              ) : (
                <div className="space-y-4">
                  {payrollHistory.map((payroll) => (
                    <Card
                      key={payroll._id}
                      size="small"
                      className="mb-2"
                      extra={
                        <Button
                          type="link"
                          onClick={() => router.push(`/dashboard/payroll/${payroll._id}`)}
                        >
                          Xem chi tiết
                        </Button>
                      }
                    >
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <div className="text-gray-500 text-sm">Ngày thanh toán</div>
                          <div className="font-semibold">
                            {formattedDate(payroll.paydate)}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-500 text-sm">Lương cơ bản</div>
                          <div className="font-semibold">
                            {payroll.basic_salary?.toLocaleString("vi-VN")} đ
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-500 text-sm">Thưởng / Khấu trừ</div>
                          <div className="font-semibold">
                            {payroll.bonus?.toLocaleString("vi-VN") || 0} đ /{" "}
                            {payroll.deductions?.toLocaleString("vi-VN") || 0} đ
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-500 text-sm">Thực nhận</div>
                          <div className="font-bold text-blue-600 text-lg">
                            {payroll.net_salary?.toLocaleString("vi-VN")} đ
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </Spin>
          </Card>
        </div>
      </Content>
    </Layout>
  );
  // 
}
