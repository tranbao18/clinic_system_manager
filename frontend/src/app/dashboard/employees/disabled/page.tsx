"use client";

import { useEffect, useState } from "react";
import {
    Table,
    Button,
    Popconfirm,
    message,
    Spin,
    Input,
    Space,
    Tag,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useRouter } from "next/navigation";
import EmployeesService from "@/lib/services/employeesService";
import { UndoOutlined, ArrowLeftOutlined } from "@ant-design/icons";

const { Search } = Input;

interface Employee {
    _id: string;
    fullname: string;
    dob: string;
    gender: string;
    phone: string;
    email: string;
    position: string;
    specialization?: string;
}

const mapGenderToApiValue = (gender: string) => {
    if (gender === "Male") return "Nam";
    if (gender === "Female") return "Nữ";
    return gender;
};

export default function DisabledEmployeesPage() {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
    const [deletingEmployeeId, setDeletingEmployeeId] = useState<string | null>(null);
    const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
    const [bulkDeleting, setBulkDeleting] = useState(false);
    const [loading, setLoading] = useState(true);
    const [searchText, setSearchText] = useState("");
    const router = useRouter();

    const fetchEmployees = async () => {
        try {
            setLoading(true);
            const data = await EmployeesService.getDisabledEmployees();
            const mapped = data.map((e: any) => ({
                _id: e._id,
                fullname: e.fullname,
                dob: e.dob,
                gender: mapGenderToApiValue(e.gender),
                phone: e.phone,
                email: e.email,
                position: e.position,
                specialization: e.specialization || "-",
            }));
            setEmployees(mapped);
            setFilteredEmployees(mapped);
        } catch (err) {
            message.error("Không thể tải danh sách nhân viên đã xóa");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchEmployees();
    }, []);

    const removeVietnameseTones = (str: string): string => {
        return str
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/đ/g, "d")
            .replace(/Đ/g, "D");
    };

    const onSearch = (value: string) => {
        setSearchText(value);
        if (!value.trim()) {
            setFilteredEmployees(employees);
        } else {
            const searchValue = removeVietnameseTones(value.toLowerCase());
            const filtered = employees.filter((emp) =>
                removeVietnameseTones(emp.fullname.toLowerCase()).includes(searchValue)
            );
            setFilteredEmployees(filtered);
        }
    };

    const handleRestore = async (id: string) => {
        try {
            await EmployeesService.restoreEmployee(id);
            message.success("Đã khôi phục nhân viên");
            fetchEmployees();
        } catch (err) {
            message.error("Khôi phục thất bại");
        }
    };

    const handlePermanentDelete = async (id: string) => {
        try {
            setDeletingEmployeeId(id);
            await EmployeesService.deleteEmployee(id, true);
            message.success("Đã xóa vĩnh viễn nhân viên");
            fetchEmployees();
        } catch (err: any) {
            console.error("Permanent delete employee failed:", err);
            message.error(err.message || "Xóa vĩnh viễn thất bại");
        } finally {
            setDeletingEmployeeId(null);
        }
    };

    const handleBulkPermanentDelete = async () => {
        if (!selectedRowKeys || selectedRowKeys.length === 0) return;
        const ids = selectedRowKeys.map(k => String(k));
        try {
            setBulkDeleting(true);
            const results = await Promise.allSettled(ids.map(id => EmployeesService.deleteEmployee(id, true)));
            const successCount = results.filter(r => r.status === "fulfilled").length;
            const failCount = results.length - successCount;
            if (successCount > 0) {
                message.success(`Đã xóa vĩnh viễn ${successCount} nhân viên`);
            }
            if (failCount > 0) {
                message.error(`${failCount} nhân viên xóa thất bại`);
            }
            setSelectedRowKeys([]);
            fetchEmployees();
        } catch (err: any) {
            console.error("Bulk delete employees failed:", err);
            message.error(err.message || "Xóa hàng loạt thất bại");
        } finally {
            setBulkDeleting(false);
        }
    };

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
            title: "Trạng thái",
            key: "status",
            render: () => (
                <Tag color="red">Đã xóa</Tag>
            ),
        },
        {
            title: "Hành động",
            render: (_, record) => (
                <div className="flex gap-2">
                    <Popconfirm
                        title="Bạn có chắc chắn muốn khôi phục?"
                        onConfirm={() => handleRestore(record._id)}
                        okText="Khôi phục"
                        cancelText="Hủy"
                    >
                        <Button type="primary" icon={<UndoOutlined />}>
                            Khôi phục
                        </Button>
                    </Popconfirm>
                    <Popconfirm
                        title="Xóa vĩnh viễn sẽ không thể khôi phục. Tiếp tục?"
                        onConfirm={() => handlePermanentDelete(record._id)}
                        okText="Xóa vĩnh viễn"
                        cancelText="Hủy"
                    >
                        <Button
                            danger
                            loading={deletingEmployeeId === record._id}
                        >
                            Xóa vĩnh viễn
                        </Button>
                    </Popconfirm>
                </div>
            ),
        },
    ];

    // TỰ VIẾT
    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-4">
                <div>
                    <Button
                        icon={<ArrowLeftOutlined />}
                        onClick={() => router.push("/dashboard/employees")}
                        className="mb-2"
                    >
                        Quay lại
                    </Button>
                    <h1 className="text-2xl font-bold">Danh sách nhân viên đã xóa</h1>

                </div>
            </div>

            <Space className="mb-4 flex flex-wrap" align="center">
                <Search
                    placeholder="Tìm theo tên nhân viên"
                    onSearch={onSearch}
                    allowClear
                    enterButton
                    style={{ width: 300 }}
                />
                <div className="ml-4">
                    <Popconfirm
                        title={() => `Bạn có chắc chắn muốn xóa vĩnh viễn ${selectedRowKeys.length} nhân viên đã chọn?`}
                        onConfirm={handleBulkPermanentDelete}
                        okText="Xóa vĩnh viễn"
                        cancelText="Hủy"
                        okButtonProps={{ loading: bulkDeleting }}
                    >
                        <Button
                            danger
                            disabled={selectedRowKeys.length === 0}
                        >
                            Xóa vĩnh viễn (hàng loạt)
                        </Button>
                    </Popconfirm>
                </div>
            </Space>

            {loading ? (
                <div className="flex justify-center items-center py-10">
                    <Spin size="large" />
                </div>
            ) : (
                <Table
                    rowKey="_id"
                    rowSelection={{
                        selectedRowKeys,
                        onChange: (keys) => setSelectedRowKeys(keys as string[]),
                        getCheckboxProps: (record) => ({
                            disabled: bulkDeleting || deletingEmployeeId === record._id,
                        }),
                    }}
                    columns={columns}
                    dataSource={filteredEmployees}
                    pagination={{ pageSize: 6, showSizeChanger: false }}
                    bordered
                />
            )}
        </div>
    );
    // 
}

