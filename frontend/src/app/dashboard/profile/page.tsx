"use client";
import { useEffect, useState } from "react";
import dayjs from "dayjs";
import {
  Card,
  Avatar,
  Typography,
  Divider,
  Spin,
  message,
  Row,
  Col,
  Button,
  Form,
  Input,
  Modal,
  DatePicker,
} from "antd";
import {
  UserOutlined,
  MailOutlined,
  PhoneOutlined,
  IdcardOutlined,
  EnvironmentOutlined,
  CalendarOutlined,
} from "@ant-design/icons";
import { useRouter } from "next/navigation";
import UsersService from "@/lib/services/usersService";
import AuthService from "@/lib/services/authService";

const { Title, Text } = Typography;


export default function ProfilePage() {
  const [data, setData] = useState<{ user?: any; employee?: any } | null>(null);
  const [loading, setLoading] = useState(true);
  const [changingPassword, setChangingPassword] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm] = Form.useForm();
  const router = useRouter();

  // TỰ VIẾT
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        // Get user data from sessionStorage instead of API to maintain per-tab sessions
        const userData = sessionStorage.getItem("user") || localStorage.getItem("user");
        if (!userData) throw new Error("Chưa đăng nhập");
        const me = JSON.parse(userData);

        const userId = me.id || me._id;
        if (!userId) throw new Error("Không tìm thấy ID người dùng");

        const result = await UsersService.getByUserId(userId);
        setData(result);
      } catch (err: any) {
        console.error(err);
        message.error(err.message || "Không thể tải thông tin tài khoản");
        router.push("/auth/login");
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [router]);

  if (loading)
    return (
      <div className="w-full h-screen flex justify-center items-center">
        <Spin size="large" />
      </div>
    );

  if (!data)
    return (
      <div className="w-full h-screen flex justify-center items-center">
        Không có thông tin người dùng
      </div>
    );
  // 

  const { user, employee } = data;
  const userId = user?._id || user?.id;
  const isAdmin = (user?.role || "").toLowerCase() === "admin";
  const canSelfChangePassword = !!userId && !isAdmin;

  const handleSubmitChangePassword = async (values: {
    oldPassword: string;
    newPassword: string;
    confirmPassword: string;
  }) => {
    if (!userId) return;
    if (values.newPassword !== values.confirmPassword) {
      message.error("Mật khẩu mới và xác nhận không khớp");
      return;
    }
    try {
      setChangingPassword(true);
      await AuthService.changePassword(userId, {
        oldPassword: values.oldPassword,
        newPassword: values.newPassword,
      });
      message.success("Đổi mật khẩu thành công");
      form.resetFields();
      setIsModalOpen(false);
    } catch (error: any) {
      message.error(error.message || "Không thể đổi mật khẩu");
    } finally {
      setChangingPassword(false);
    }
  };

  // TỰ VIẾT
  const openEditModal = () => {
    editForm.setFieldsValue({
      dob: data.employee?.dob ? dayjs(data.employee.dob) : null,
      email: data.employee?.email || user?.email || "",
      phone: data.employee?.phone || "",
    });
    setIsEditModalOpen(true);
  };
  // 
  const handleSubmitEditProfile = async (values: any) => {
    try {
      const userId = user?._id || user?.id;
      if (!userId) throw new Error("Không tìm thấy user id");
      const payload: any = {};
      if (values.dob) payload.dob = dayjs(values.dob).format("YYYY-MM-DD");
      if (values.email !== undefined) payload.email = values.email;
      if (values.phone !== undefined) payload.phone = values.phone;
      await UsersService.updateAccount(userId, payload);
      const refreshed = await UsersService.getByUserId(userId);
      setData(refreshed);
      message.success("Cập nhật thông tin cá nhân thành công");
      setIsEditModalOpen(false);
    } catch (err: any) {
      console.error("Update profile failed:", err);
      message.error(err.message || "Cập nhật thất bại");
    }
  };

  return (
    <div className="p-6 flex justify-center bg-gray-50 min-h-screen">
      <Card
        className="w-full max-w-3xl shadow-xl rounded-2xl border border-gray-200"
        styles={{ body: { padding: "2rem" } }}
      >
        {/* Header - themed banner */}
        <div className="w-full mb-6">
          <div className="relative rounded-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-[#0ea5a4] to-[#60a5fa] p-6 text-white">
              <div className="flex items-center gap-6">
                <Avatar
                  size={96}
                  src="/logo_phong_kham.png"
                  className="!mb-0 ring-4 ring-white bg-white/10"
                />
                <div>
                  <Title className="!mb-0 text-white/90">
                    {employee?.fullname || user?.username}
                  </Title>
                  <Text className="text-white/90">
                    {employee?.position || user?.role || "Nhân viên"}
                  </Text>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="text-xs bg-white/20 px-2 py-1 rounded">ID: {employee?._id || "-"}</span>
                    <span className="text-xs bg-white/20 px-2 py-1 rounded">Trạng thái: Hoạt động</span>
                  </div>
                </div>
              </div>
            </div>

            {/* decorative SVG */}
            <svg className="absolute right-2 top-2 w-20 h-20 opacity-20" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M12 2v6" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M8 8a4 4 0 1 0 8 0v6a4 4 0 1 1-8 0V8z" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </div>
        </div>

        <Divider className="border-gray-200" />

        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12}>
            <Card className="rounded-xl shadow-sm border border-gray-100" size="small">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-md bg-gradient-to-br from-[#0ea5a4] to-[#60a5fa] flex items-center justify-center text-white">
                  <IdcardOutlined />
                </div>
                <div>
                  <Text strong className="block">Mã nhân viên</Text>
                  <div className="text-sm">{employee?._id || "-"}</div>
                </div>
              </div>

              <Divider className="my-4" />

              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-md bg-gradient-to-br from-[#7dd3fc] to-[#60a5fa] flex items-center justify-center text-white">
                  <MailOutlined />
                </div>
                <div>
                  <Text strong className="block">Email</Text>
                  <div className="text-sm">{employee?.email || user?.email || "-"}</div>
                </div>
              </div>

              <Divider className="my-4" />

              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-md bg-gradient-to-br from-[#34d399] to-[#0ea5a4] flex items-center justify-center text-white">
                  <PhoneOutlined />
                </div>
                <div>
                  <Text strong className="block">Điện thoại</Text>
                  <div className="text-sm">{employee?.phone || "-"}</div>
                </div>
              </div>
            </Card>
          </Col>

          <Col xs={24} sm={12}>
            <Card className="rounded-xl shadow-sm border border-gray-100" size="small">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-md bg-gradient-to-br from-[#60a5fa] to-[#7dd3fc] flex items-center justify-center text-white">
                  <EnvironmentOutlined />
                </div>
                <div>
                  <Text strong className="block">Ngày sinh</Text>
                  <div className="text-sm">{employee?.dob ? new Date(employee.dob).toLocaleDateString("vi-VN") : "-"}</div>
                </div>
              </div>

              <Divider className="my-4" />

              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-md bg-gradient-to-br from-[#0ea5a4] to-[#34d399] flex items-center justify-center text-white">
                  <UserOutlined />
                </div>
                <div>
                  <Text strong className="block">Tài khoản</Text>
                  <div className="text-sm">{user?.username || "-"}</div>
                </div>
              </div>

              <Divider className="my-4" />

              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-md bg-gradient-to-br from-[#60a5fa] to-[#0ea5a4] flex items-center justify-center text-white">
                  <CalendarOutlined />
                </div>
                <div>
                  <Text strong className="block">Ngày tạo</Text>
                  <div className="text-sm">{user?.created_at ? new Date(user.created_at).toLocaleDateString("vi-VN") : "-"}</div>
                </div>
              </div>
            </Card>
          </Col>
        </Row>
        <div className="mt-4 flex justify-end gap-2">
          <Button onClick={() => {
            openEditModal();
          }}>
            Chỉnh sửa thông tin
          </Button>
          {canSelfChangePassword && (
            <Button type="primary" onClick={() => setIsModalOpen(true)}>
              Đổi mật khẩu
            </Button>
          )}
        </div>

        {canSelfChangePassword && (
          <>
            <Modal
              title="Đổi mật khẩu"
              open={isModalOpen}
              footer={null}
              destroyOnHidden
              onCancel={() => {
                setIsModalOpen(false);
                form.resetFields();
              }}
            >
              <Form
                layout="vertical"
                form={form}
                onFinish={handleSubmitChangePassword}
              >
                <Form.Item
                  label="Mật khẩu hiện tại"
                  name="oldPassword"
                  rules={[{ required: true, message: "Nhập mật khẩu hiện tại" }]}
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
                  rules={[{ required: true, message: "Xác nhận mật khẩu mới" }]}
                >
                  <Input.Password placeholder="Nhập lại mật khẩu mới" />
                </Form.Item>
                <div className="text-right">
                  <Button
                    className="mr-2"
                    onClick={() => {
                      setIsModalOpen(false);
                      form.resetFields();
                    }}
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

        <Modal
          title="Chỉnh sửa thông tin cá nhân"
          open={isEditModalOpen}
          onCancel={() => {
            setIsEditModalOpen(false);
            editForm.resetFields();
          }}
          footer={null}
          destroyOnHidden
        >
          <Form layout="vertical" form={editForm} onFinish={handleSubmitEditProfile}>
            <Form.Item label="Email" name="email" rules={[{ type: "email", message: "Email không hợp lệ" }]}>
              <Input />
            </Form.Item>
            <Form.Item label="Số điện thoại" name="phone">
              <Input />
            </Form.Item>
            <Form.Item label="Ngày sinh" name="dob">
              <DatePicker style={{ width: "100%" }} />
            </Form.Item>
            <div className="text-right">
              <Button className="mr-2" onClick={() => { setIsEditModalOpen(false); editForm.resetFields(); }}>
                Hủy
              </Button>
              <Button type="primary" htmlType="submit">
                Lưu
              </Button>
            </div>
          </Form>
        </Modal>

        <Divider className="border-gray-200 mt-6" />
        <div className="text-center text-gray-500 text-sm">
          <Text type="secondary">
            Thông tin tài khoản được cập nhật lần cuối:{" "}
            {user?.updated_at
              ? new Date(user.updated_at).toLocaleDateString("vi-VN")
              : "-"}
          </Text>
        </div>
      </Card>
    </div>
  );
}
