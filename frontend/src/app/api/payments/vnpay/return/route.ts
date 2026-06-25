import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "https://meppod.onrender.com";

/**
 * Xử lý VNPay Return URL
 * VNPay sẽ redirect về route này với các query params
 * Route này sẽ gọi backend để xử lý, sau đó redirect về frontend
 */
export async function GET(req: NextRequest) {
    try {
        const searchParams = req.nextUrl.searchParams;

        console.log('📥 VNPay Return - Nhận params:', Array.from(searchParams.keys()));

        const invoiceId = searchParams.get('vnp_TxnRef');
        if (!invoiceId) {
            return NextResponse.redirect(
                new URL('/dashboard/invoices?error=missing_invoice_id', req.url)
            );
        }

        const backendUrl = `${BACKEND_URL}/api/payments/vnpay-return?${searchParams.toString()}`;
        console.log('🔄 Calling backend:', backendUrl);
        console.log('🔧 BACKEND_URL:', BACKEND_URL);
        console.log('📋 Search params:', searchParams.toString());

        try {
            const backendRes = await fetch(backendUrl, {
                method: 'GET',
                redirect: 'manual', // Không follow redirect
                headers: {
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                },
            });

            console.log('📥 Backend response:', {
                status: backendRes.status,
                statusText: backendRes.statusText,
                ok: backendRes.ok,
                headers: Object.fromEntries(backendRes.headers.entries())
            });

            if (backendRes.status >= 300 && backendRes.status < 400) {
                const redirectUrl = backendRes.headers.get('Location');
                if (redirectUrl) {
                    console.log('✅ Backend redirect to:', redirectUrl);
                    return NextResponse.redirect(redirectUrl);
                }
            }

            const responseText = await backendRes.text();
            console.log('⚠️ Backend response text:', responseText);

            return NextResponse.redirect(
                new URL(`/dashboard/invoices/${invoiceId}?payment=success`, req.url)
            );
        } catch (fetchErr: any) {
            console.error('❌ Backend fetch error:', fetchErr);
            return NextResponse.redirect(
                new URL(`/dashboard/invoices/${invoiceId}?payment=failed&message=${encodeURIComponent(fetchErr.message)}`, req.url)
            );
        }
    } catch (err: any) {
        console.error('❌ VNPay Return handler error:', err);
        const invoiceId = req.nextUrl.searchParams.get('vnp_TxnRef') || 'unknown';
        return NextResponse.redirect(
            new URL(`/dashboard/invoices/${invoiceId}?payment=failed&message=${encodeURIComponent(err.message)}`, req.url)
        );
    }
}

