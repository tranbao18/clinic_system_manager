// KẾ THỪA
"use client";

import { Form, Input, Button, DatePicker, Select, Upload } from "antd";
import { UploadOutlined } from "@ant-design/icons";
import dayjs from "dayjs";

interface DoctorFormProps {
    onFinish: (values: any) => void;
    loading?: boolean;
    initialValues?: any;
    disabled?: boolean;
}

export default function DoctorForm({ onFinish, loading, initialValues, disabled }: DoctorFormProps) {
    const normalizedValues = {
        ...initialValues,
        avatar: initialValues?.avatar
            ? Array.isArray(initialValues.avatar)
                ? initialValues.avatar
                : [
                    {
                        uid: "-1",
                        name: "avatar.jpg",
                        status: "done",
                        url: initialValues.avatar, // nếu API trả về string (URL)
                    },
                ]
            : [],
        birthdate: initialValues?.birthdate
            ? dayjs(initialValues.birthdate) // ✅ convert string -> dayjs
            : null,
    };
    return (
        <Form
            id="doctor-form"
            layout="vertical"
            onFinish={onFinish}
            initialValues={normalizedValues}
        >
            <Form.Item label="Tên bác sĩ" name="name" rules={[{ required: true }]}>
                <Input disabled={disabled} />
            </Form.Item>

            <Form.Item
                label="Ảnh đại diện"
                name="avatar"
                valuePropName="fileList"
                getValueFromEvent={(e) => {
                    if (Array.isArray(e)) return e;
                    return e && e.fileList ? e.fileList : [];
                }}>
                <Upload
                    name="file"
                    listType="picture"
                    maxCount={1}
                    beforeUpload={() => false}
                    disabled={disabled}
                >
                    <Button icon={<UploadOutlined />}>Chọn ảnh</Button>
                </Upload>
            </Form.Item>

            <Form.Item label="Giới tính" name="gender">
                <Select
                    disabled={disabled}
                    options={[
                        { label: "Nam", value: "male" },
                        { label: "Nữ", value: "female" },
                        { label: "Khác", value: "other" },
                    ]}
                />
            </Form.Item>

            <Form.Item label="Email" name="email" rules={[{ type: "email" }]}>
                <Input disabled={disabled} />
            </Form.Item>

            <Form.Item label="Thành phố" name="city">
                <Input disabled={disabled} />
            </Form.Item>

            <Form.Item label="Ngày sinh" name="birthdate">
                <DatePicker disabled={disabled} format="YYYY-MM-DD" style={{ width: "100%" }} />
            </Form.Item>

            <Form.Item label="Địa chỉ" name="address">
                <Input.TextArea rows={3} disabled={disabled} />
            </Form.Item>

        </Form>
    );
}
