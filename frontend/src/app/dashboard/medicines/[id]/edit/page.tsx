// KẾ THỪA
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    Input,
    Button,
    Form,
    Spin,
    message,
    Card,
    InputNumber,
    Select,
} from "antd";
import {
    getMedicineById,
    updateMedicine,
    Medicine,
    UpdateMedicineData,
    MEDICINE_CATEGORIES,
} from "@/lib/services/medicinesService";

export default function EditMedicinePage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const [form] = Form.useForm();
    const [medicine, setMedicine] = useState<Medicine | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // TỰ VIẾT
    useEffect(() => {
        const fetchRole = async () => {
            try {
                const res = await fetch("/api/session", { cache: "no-store" });
                const data = await res.json();
                const r = (data?.user?.role || "").toLowerCase();
                if (r && r !== "admin" && r !== "accountant" && r !== "pharmacist") {
                    message.warning("Bạn không có quyền truy cập trang này");
                    router.push("/dashboard/medicines");
                }
            } catch {
                router.push("/auth/login");
            }
        };
        fetchRole();
    }, []);
    // 

    useEffect(() => {
        if (!id) return;

        const fetchMedicine = async () => {
            try {
                setLoading(true);
                const data = await getMedicineById(id);
                setMedicine(data);
                form.setFieldsValue({
                    name: data.name,
                    category: Array.isArray(data.category) ? data.category : (data.category ? [data.category] : []),
                    unit: data.unit,
                    price: data.price,
                });
            } catch (err) {
                console.error(err);
                message.error("Không thể tải thông tin thuốc");
                router.push("/dashboard/medicines");
            } finally {
                setLoading(false);
            }
        };

        fetchMedicine();
    }, [id, form, router]);

    const handleUpdate = async (values: UpdateMedicineData) => {
        try {
            setSaving(true);

            const categoryArray = Array.isArray(values.category) ? values.category : [];

            const payload: UpdateMedicineData = {
                name: values.name?.trim(),
                category: categoryArray,
                unit: values.unit?.trim(),
                price: values.price,
            };

            const updatedData: UpdateMedicineData = {};
            if (payload.name && payload.name !== medicine?.name) {
                updatedData.name = payload.name;
            }
            const currentCategories = Array.isArray(medicine?.category)
                ? medicine.category
                : (medicine?.category ? [medicine.category] : []);
            const categoriesEqual =
                categoryArray.length === currentCategories.length &&
                categoryArray.every((cat, idx) => cat === currentCategories[idx]);
            if (!categoriesEqual) {
                updatedData.category = categoryArray;
            }
            if (payload.unit && payload.unit !== medicine?.unit) {
                updatedData.unit = payload.unit;
            }
            if (payload.price !== undefined && payload.price !== medicine?.price) {
                updatedData.price = payload.price;
            }

            await updateMedicine(id, updatedData);
            message.success("Cập nhật thông tin thành công!");
            router.push("/dashboard/medicines");
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : "Cập nhật thất bại";
            console.error(error);
            message.error(errorMessage);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center py-10">
                <Spin size="large" />
            </div>
        );
    }

    if (!medicine) {
        return (
            <div className="flex justify-center items-center py-10">
                <p className="text-gray-500">Không tìm thấy thuốc</p>
            </div>
        );
    }
    // TỰ VIẾT
    return (
        <div className="p-6 max-w-3xl mx-auto">
            <div>
                <Button onClick={() => router.back()} className="mb-4">
                    ← Quay lại
                </Button>
            </div>

            <Card
                title="✏️ Chỉnh sửa thông tin thuốc"
                variant="borderless"
                className="shadow-md rounded-2xl"
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleUpdate}
                    className="mt-4"
                >
                    <Form.Item
                        label="Tên thuốc"
                        name="name"
                        rules={[
                            { required: true, message: "Vui lòng nhập tên thuốc" },
                            { min: 2, message: "Tên thuốc phải có ít nhất 2 ký tự" },
                        ]}
                    >
                        <Input placeholder="VD: Paracetamol 500mg" />
                    </Form.Item>

                    <div className="grid grid-cols-2 gap-4">
                        <Form.Item
                            label="Danh mục"
                            name="category"
                            tooltip="Chọn một hoặc nhiều danh mục cho thuốc (tối đa 2 danh mục)"
                            rules={[
                                {
                                    validator: (_, value) => {
                                        if (!value || value.length === 0) {
                                            return Promise.resolve();
                                        }
                                        if (value.length > 3) {
                                            return Promise.reject(new Error("Chỉ được chọn tối đa 2 danh mục"));
                                        }
                                        return Promise.resolve();
                                    },
                                },
                            ]}
                        >
                            <Select
                                mode="multiple"
                                placeholder="Chọn danh mục (tối đa 2)"
                                maxTagCount={2}
                                allowClear
                            >
                                {MEDICINE_CATEGORIES.map((cat) => (
                                    <Select.Option key={cat} value={cat}>
                                        {cat}
                                    </Select.Option>
                                ))}
                            </Select>
                        </Form.Item>

                        <Form.Item
                            label="Đơn vị"
                            name="unit"
                            rules={[
                                { required: true, message: "Vui lòng nhập đơn vị" },
                            ]}
                            tooltip="Đơn vị tính (VD: viên, hộp, chai, ...)"
                        >
                            <Input placeholder="VD: viên, hộp, chai" />
                        </Form.Item>
                    </div>

                    <Form.Item
                        label="Giá (VND)"
                        name="price"
                        rules={[
                            { required: true, message: "Vui lòng nhập giá" },
                            {
                                type: "number",
                                min: 1,
                                message: "Giá phải lớn hơn 0",
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

                    <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-600">
                            <strong>Mã thuốc:</strong> {medicine._id}
                        </p>
                        <p className="text-sm text-gray-600">
                            <strong>Ngày tạo:</strong>{" "}
                            {new Date(medicine.created_at).toLocaleString("vi-VN")}
                        </p>
                        <p className="text-sm text-gray-600">
                            <strong>Cập nhật gần nhất:</strong>{" "}
                            {new Date(medicine.updated_at).toLocaleString("vi-VN")}
                        </p>
                    </div>

                    <div className="flex justify-end gap-3 mt-6">
                        <Button onClick={() => router.back()}>Hủy</Button>
                        <Button
                            type="primary"
                            htmlType="submit"
                            loading={saving}
                            className="bg-blue-600"
                        >
                            Cập nhật
                        </Button>
                    </div>
                </Form>
            </Card>
        </div>
    );
    // 
}

