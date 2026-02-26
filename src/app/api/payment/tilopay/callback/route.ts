import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code'); // 1 = Approved
    const description = searchParams.get('description');
    const orderNumber = searchParams.get('order');
    const placa = searchParams.get('placa');

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001';

    if (code === '1') {
        // Payment Approved
        try {
            // Optional: Verify order status with TiloPay API here for extra security

            // Redirect to success page
            return NextResponse.redirect(`${baseUrl}/portal/${placa}/payment-success?order=${orderNumber}`);
        } catch (error) {
            console.error('Error in TiloPay callback:', error);
            return NextResponse.redirect(`${baseUrl}/portal/${placa}?error=payment_processing_error`);
        }
    } else {
        // Payment Declined or Error
        return NextResponse.redirect(`${baseUrl}/portal/${placa}?error=${description || 'payment_failed'}`);
    }
}
