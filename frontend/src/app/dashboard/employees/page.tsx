"use client";

import { useEffect, useState } from "react";
import {
  Layout,
  Table,
  Button,
  Input,
  Spin,
  message,
  Select,
  Popconfirm,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useRouter } from "next/navigation";
import EmployeesService from "@/lib/services/employeesService";

const { Content } = Layout;
const { Search } = Input;

interface Employee {
  key: string;
  _id: string;
  fullname: string;
  dob: string;
  gender: string;
  phone: string;
  email: string;
  position: string;
  specialization?: string;
  created_at: string;
}


export default function EmployeesPage() {
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [role, setRole] = useState<string>("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // TỰ VIẾT
  function removeVietnameseTones(str: string): string {
    return str
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D");
  }
  //

  // TỰ VIẾT
  const onSearch = (value: string) => {
    if (!value.trim()) {
      setEmployees(allEmployees);
    } else {
      const searchValue = removeVietnameseTones(value.toLowerCase());
      const filtered = allEmployees.filter((emp) =>
        removeVietnameseTones(emp.fullname.toLowerCase()).includes(searchValue)
      );
      setEmployees(filtered);
    }
  };
  //

  // TỰ VIẾT
  const onFilterByRole = (value: string | null) => {
    if (!value) {
      setEmployees(allEmployees);
    } else {
      const filtered = allEmployees.filter(
        (emp) => emp.position.toLowerCase() === value.toLowerCase()
      );
      setEmployees(filtered);
    }
  };
  //

  // TỰ VIẾT
  const handleDelete = async (id: string) => {
    try {
      await EmployeesService.deleteEmployee(id);
      message.success("Xóa nhân viên thành công");

      setAllEmployees((prev) => prev.filter((e) => e._id !== id));
      setEmployees((prev) => prev.filter((e) => e._id !== id));
    } catch (err: any) {
      console.error("Delete error:", err);
      message.error(err.message || "Lỗi khi xóa nhân viên");
    }
  };
  //

  const mapGenderToApiValue = (gender: string) => {
    if (gender === "Male") return "Nam";
    if (gender === "Female") return "Nữ";
    return gender;
  };
  useEffect(() => {
    const fetchRole = async () => {
      try {
        const res = await fetch("/api/session", { cache: "no-store" });
        const data = await res.json();
        setRole((data?.user?.role || "").toLowerCase());
      } catch {
        setRole("");
      }
    };
    fetchRole();
  }, []);

  const canDelete = role === "admin";

  const columns: ColumnsType<Employee> = [
    { title: "Họ tên", dataIndex: "fullname" },
    { title: "Giới tính", dataIndex: "gender" },
    { title: "Chức vụ", dataIndex: "position" },
    { title: "Chuyên môn", dataIndex: "specialization" },
    { title: "Email", dataIndex: "email" },
    { title: "Số điện thoại", dataIndex: "phone" },
    {
      title: "Ngày sinh",
      dataIndex: "dob",
      render: (value: string) => {
        if (!value) return "-";
        const date = new Date(value);
        return `${date.getDate().toString().padStart(2, "0")}/${(
          date.getMonth() + 1
        )
          .toString()
          .padStart(2, "0")}/${date.getFullYear()}`;
      },
    },

    {
      title: "Hành động",
      render: (_, record) => (
        <div className="flex gap-2">
          <Button onClick={() => router.push(`/dashboard/employees/${record._id}`)}>
            Xem chi tiết
          </Button>
          {canDelete && (
            <Popconfirm
              title="Bạn có chắc muốn xóa nhân viên này?"
              onConfirm={() => handleDelete(record._id)}
              okText="Xóa"
              cancelText="Hủy"
            >
              <Button danger>Xóa</Button>
            </Popconfirm>
          )}
        </div>
      ),
    },
  ];

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        setLoading(true);
        const data = await EmployeesService.getAll();
        const mapped = data.map((e: any, index: number) => ({
          key: e._id || index.toString(),
          _id: e._id,
          fullname: e.fullname,
          dob: e.dob,
          gender: mapGenderToApiValue(e.gender),
          phone: e.phone,
          email: e.email,
          position: e.position,
          specialization: e.specialization || "-",
          created_at: e.created_at,
        }));
        setAllEmployees(mapped);
        setEmployees(mapped);
      } catch (err) {
        message.error("Không thể tải danh sách nhân viên");
      } finally {
        setLoading(false);
      }
    };
    fetchEmployees();
  }, []);

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Layout>
        <Content className="m-4 p-4 bg-white rounded shadow">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-3xl font-bold">Danh sách Nhân viên</h2>
            <div className="flex gap-2">
              {canDelete && (
                <Button
                  onClick={() => router.push("/dashboard/employees/disabled")}
                >
                  Thùng rác
                </Button>
              )}
              <Button
                type="primary"
                onClick={() => router.push("/dashboard/employees/new")}
              >
                Tạo nhân viên
              </Button>
            </div>
          </div>

          {/* Tìm kiếm & Lọc */}
          <div className="flex gap-4 mb-4">
            <Search
              placeholder="Tìm theo tên nhân viên"
              onSearch={onSearch}
              allowClear
              enterButton
              className="w-80"
            />

            <Select
              allowClear
              placeholder="Lọc theo chức vụ"
              onChange={onFilterByRole}
              className="w-60"
              options={[
                { label: "Bác sĩ", value: "Bác sĩ" },
                { label: "Y tá", value: "Y tá" },
                { label: "Lễ tân", value: "Lễ tân" },
                { label: "Kế toán", value: "Kế toán" },
              ]}
            />
          </div>

          {loading ? (
            <div className="flex justify-center items-center py-10">
              <Spin size="large" />
            </div>
          ) : (
            <Table
              columns={columns}
              dataSource={employees}
              pagination={{ pageSize: 6, showSizeChanger: false }}
              bordered
            />
          )}
        </Content>
      </Layout>
    </Layout>
  );
}
//
