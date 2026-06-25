// KẾ THỪA
import { NextRequest, NextResponse } from "next/server";
import { getAuthHeaderServer } from "@/lib/authHeaderServer";

const API_URL = `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/payrolls`;

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const authHeaders = await getAuthHeaderServer();
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
    };

    if (authHeaders.Authorization) {
        headers.Authorization = authHeaders.Authorization;
    }

    const response = await fetch(`${API_URL}/${id}`, {
        headers,
        cache: "no-store",
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
}

export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const body = await req.json();
    const authHeaders = await getAuthHeaderServer();
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
    };

    if (authHeaders.Authorization) {
        headers.Authorization = authHeaders.Authorization;
    }

    const { searchParams } = new URL(req.url);
    const sendEmail = searchParams.get("sendEmail");

    let url = `${API_URL}/${id}`;
    if (sendEmail === "false") {
        url += "?sendEmail=false";
    }

    const response = await fetch(url, {
        method: "PUT",
        headers,
        body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const authHeaders = await getAuthHeaderServer();
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
    };

    if (authHeaders.Authorization) {
        headers.Authorization = authHeaders.Authorization;
    }

    const response = await fetch(`${API_URL}/${id}`, {
        method: "DELETE",
        headers,
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
}

