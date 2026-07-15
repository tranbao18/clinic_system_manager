"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
    Input,
    Button,
    Form,
    message,
    Card,
    InputNumber,
    Select,
} from "antd";
import { createMedicine, CreateMedicineData, MEDICINE_CATEGORIES } from "@/lib/services/medicinesService";

// TỰ VIẾT
export default function NewMedicinePage() {
    const router = useRouter();
    const [form] = Form.useForm();
    const [saving, setSaving] = useState(false);

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

    const handleCreateMedicine = async (values: CreateMedicineData) => {
        try {
            setSaving(true);

            const payload: CreateMedicineData = {
                name: values.name.trim(),
                category: Array.isArray(values.category) ? values.category : [],
                unit: values.unit.trim(),
                price: values.price,
            };

            await createMedicine(payload);
            message.success("Thêm thuốc thành công!");
            router.push("/dashboard/medicines");
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : "Không thể thêm thuốc";
            console.error(error);
            message.error(errorMessage);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="p-6 max-w-3xl mx-auto">
            <Card
                title="💊 Thêm thuốc mới"
                className="shadow-md rounded-2xl"
                bordered={false}
            >
                <Form
                    layout="vertical"
                    form={form}
                    onFinish={handleCreateMedicine}
                    initialValues={{
                        name: "",
                        category: [],
                        unit: "",
                        price: 0,
                    }}
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
                                        if (value.length > 2) {
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

                    <div className="flex justify-end gap-3 mt-6">
                        <Button onClick={() => router.back()}>Hủy</Button>
                        <Button type="primary" htmlType="submit" loading={saving}>
                            Thêm thuốc
                        </Button>
                    </div>
                </Form>
            </Card>
        </div>
    );
}
//

