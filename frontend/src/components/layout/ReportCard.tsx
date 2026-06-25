// TỰ VIẾT
"use client";

import { Card } from "antd";
import { ReactNode } from "react";

interface ReportCardProps {
    title: string;
    value: string | number;
    icon?: ReactNode;
    color?: string;
}

export default function ReportCard({ title, value, icon, color }: ReportCardProps) {
    return (
        <Card className="shadow-md rounded-lg" style={{ borderLeft: `5px solid ${color || "#1677ff"}` }}>
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-gray-500 text-sm">{title}</p>
                    <h2 className="text-xl font-bold">{value}</h2>
                </div>
                {icon && <div className="text-2xl">{icon}</div>}
            </div>
        </Card>
    );
}
