"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
    Input,
    Button,
    Form,
    message,
    Card,
    InputNumber,
    DatePicker,
    Select,
    Spin,
} from "antd";
import dayjs from "dayjs";
import {
    createMedicineImport,
    CreateMedicineImportData,
} from "@/lib/services/medicineImportsService";
import { getMedicines, Medicine } from "@/lib/services/medicinesService";
import EmployeesService from "@/lib/services/employeesService";

export default function NewMedicineImportPage() {
    const router = useRouter();
    const [form] = Form.useForm();
    const [saving, setSaving] = useState(false);
    const [medicines, setMedicines] = useState<Medicine[]>([]);
    const [employees, setEmployees] = useState<any[]>([]);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    // TỰ VIẾT
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);

            // Đọc người dùng hiện tại trước: lỗi tải danh sách nhân viên không được làm mất giá trị mặc định "Người nhập"
            let user: any = null;
            try {
                const userDataStr = sessionStorage.getItem("user") || localStorage.getItem("user");
                if (userDataStr) {
                    user = JSON.parse(userDataStr);
                    setCurrentUser(user);
                }
            } catch (error) {
                console.error("Parse current user error:", error);
            }

            // Tải độc lập để một nguồn lỗi không chặn nguồn còn lại
            const [medicinesResult, employeesResult] = await Promise.allSettled([
                getMedicines(),
                EmployeesService.getAll(),
            ]);

            if (medicinesResult.status === "fulfilled") {
                setMedicines(medicinesResult.value);
            } else {
                console.error("Fetch medicines error:", medicinesResult.reason);
                message.error(medicinesResult.reason?.message || "Không thể tải danh sách thuốc");
            }

            if (employeesResult.status === "fulfilled") {
                setEmployees(Array.isArray(employeesResult.value) ? employeesResult.value : []);
            } else {
                console.error("Fetch employees error:", employeesResult.reason);
                message.warning(
                    user?.employee_id
                        ? "Không thể tải danh sách nhân viên, người nhập mặc định là tài khoản hiện tại"
                        : "Không thể tải danh sách nhân viên"
                );
            }

            setLoading(false);
        };
        fetchData();
    }, []);

    const currentEmployeeId: string | undefined =
        currentUser?.employee_id && typeof currentUser.employee_id === "object"
            ? currentUser.employee_id._id
            : currentUser?.employee_id || undefined;

    // Luôn có lựa chọn cho người dùng hiện tại, kể cả khi không tải được danh sách nhân viên
    const employeeOptions = useMemo(() => {
        const options = employees.map((e) => ({
            value: e._id,
            label: `${e.fullname} - ${e.position}`,
        }));
        if (currentEmployeeId && !options.some((o) => o.value === currentEmployeeId)) {
            options.unshift({
                value: currentEmployeeId,
                label: `${currentUser?.username || "Tôi"} (tài khoản hiện tại)`,
            });
        }
        return options;
    }, [employees, currentEmployeeId, currentUser?.username]);

    const handleCreate = async (values: any) => {
        try {
            setSaving(true);

            const payload: CreateMedicineImportData = {
                medicine_id: values.medicine_id,
                supplier: values.supplier.trim(),
                batchcode: values.batchcode.trim(),
                quantity: values.quantity,
                unit_price: values.unit_price,
                // Ngày thuần (không giờ) để không bị lệch sang ngày hôm trước do múi giờ
                expiry_date: dayjs(values.expiry_date).format("YYYY-MM-DD"),
                import_date: dayjs(values.import_date).format("YYYY-MM-DD"),
                imported_by: values.imported_by,
            };

            await createMedicineImport(payload);
            message.success("Nhập thuốc thành công!");
            router.push("/dashboard/medicine-imports");
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : "Không thể tạo nhập thuốc";
            console.error(error);
            message.error(errorMessage);
        } finally {
            setSaving(false);
        }
    };
    // 

    if (loading) {
        return (
            <div className="flex justify-center items-center py-10">
                <Spin size="large" />
            </div>
        );
    }
    // TỰ VIẾT
    return (
        <div className="p-6 max-w-3xl mx-auto">
            <Card
                title="📦 Nhập thuốc mới"
                className="shadow-md rounded-2xl"
                variant="borderless"
            >
                <Form
                    layout="vertical"
                    form={form}
                    onFinish={handleCreate}
                    initialValues={{
                        import_date: dayjs(),
                        imported_by: currentEmployeeId,
                    }}
                >
                    <Form.Item
                        label="Thuốc"
                        name="medicine_id"
                        rules={[{ required: true, message: "Vui lòng chọn thuốc" }]}
                    >
                        <Select
                            placeholder="Chọn thuốc"
                            showSearch
                            filterOption={(input, option) =>
                                (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
                            }
                            options={medicines.map((m) => ({
                                value: m._id,
                                label: `${m.name} (${m.unit})`,
                            }))}
                        />
                    </Form.Item>

                    <div className="grid grid-cols-2 gap-4">
                        <Form.Item
                            label="Nhà cung cấp"
                            name="supplier"
                            rules={[{ required: true, message: "Vui lòng nhập nhà cung cấp" }]}
                        >
                            <Input placeholder="VD: Công ty ABC" />
                        </Form.Item>

                        <Form.Item
                            label="Mã lô"
                            name="batchcode"
                            rules={[{ required: true, message: "Vui lòng nhập mã lô" }]}
                        >
                            <Input placeholder="VD: LOT2024001" />
                        </Form.Item>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Form.Item
                            label="Số lượng"
                            name="quantity"
                            rules={[
                                { required: true, message: "Vui lòng nhập số lượng" },
                                {
                                    type: "number",
                                    min: 1,
                                    message: "Số lượng phải lớn hơn 0",
                                },
                            ]}
                        >
                            <InputNumber
                                className="w-full"
                                placeholder="VD: 100"
                                min={1}
                                step={1}
                            />
                        </Form.Item>

                        <Form.Item
                            label="Giá nhập (VND)"
                            name="unit_price"
                            rules={[
                                { required: true, message: "Vui lòng nhập giá nhập" },
                                {
                                    type: "number",
                                    min: 1,
                                    message: "Giá nhập phải lớn hơn 0",
                                },
                            ]}
                        >
                            <InputNumber
                                className="w-full"
                                placeholder="VD: 50000"
                                min={0}
                                step={1000}
                                formatter={(value) =>
                                    value ? `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : ""
                                }
                            />
                        </Form.Item>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Form.Item
                            label="Hạn sử dụng"
                            name="expiry_date"
                            rules={[{ required: true, message: "Vui lòng chọn hạn sử dụng" }]}
                        >
                            <DatePicker
                                className="w-full"
                                format="DD/MM/YYYY"
                                placeholder="Chọn hạn sử dụng"
                                disabledDate={(current) => current && current < dayjs().startOf("day")}
                            />
                        </Form.Item>

                        <Form.Item
                            label="Ngày nhập"
                            name="import_date"
                            rules={[{ required: true, message: "Vui lòng chọn ngày nhập" }]}
                        >
                            <DatePicker
                                className="w-full"
                                format="DD/MM/YYYY"
                                placeholder="Chọn ngày nhập"
                            />
                        </Form.Item>
                    </div>

                    <Form.Item
                        label="Người nhập"
                        name="imported_by"
                        rules={[{ required: true, message: "Vui lòng chọn người nhập" }]}
                    >
                        <Select
                            placeholder="Chọn người nhập"
                            showSearch
                            filterOption={(input, option) =>
                                (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
                            }
                            options={employeeOptions}
                        />
                    </Form.Item>

                    <div className="flex justify-end gap-3 mt-6">
                        <Button onClick={() => router.back()}>Hủy</Button>
                        <Button type="primary" htmlType="submit" loading={saving}>
                            Nhập thuốc
                        </Button>
                    </div>
                </Form>
            </Card>
        </div>
    );
    // 
}


