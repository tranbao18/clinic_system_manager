// KẾ THỪA
import { NextRequest, NextResponse } from "next/server";
import { getAuthHeaderServer } from "@/lib/authHeaderServer";

const API_URL = `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/payrolls`;

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ employee_id: string }> }
) {
    const { employee_id } = await params;
    const authHeaders = await getAuthHeaderServer();
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
    };

    if (authHeaders.Authorization) {
        headers.Authorization = authHeaders.Authorization;
    }

    const response = await fetch(`${API_URL}/send/${employee_id}`, {
        method: "POST",
        headers,
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
}

