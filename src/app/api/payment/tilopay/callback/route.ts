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
            const amountStr = searchParams.get('amount') || '0';
            let remainingPayment = parseFloat(amountStr);

            if (remainingPayment > 0 && placa) {
                // 1. Find Client via Placa
                const formattedPlate = placa.trim().toUpperCase();
                const { data: vehicle } = await supabase.from('Vehiculos').select('Usuario_ID').eq('Placas', formattedPlate).single();

                if (vehicle) {
                    const { data: user } = await supabase.from('Usuarios').select('CLIENTE_ID').eq('id', vehicle.Usuario_ID).single();

                    if (user && user.CLIENTE_ID) {
                        const clienteId = user.CLIENTE_ID;

                        // 2. Fetch pending invoices ordered by date ascending (oldest first)
                        const { data: facturas } = await supabase
                            .from('Facturas')
                            .select('*')
                            .eq('cliente_id', clienteId)
                            .in('estado', ['pendiente', 'abono'])
                            .order('fecha_emision', { ascending: true });

                        if (facturas && facturas.length > 0) {
                            // Fetch existing payments to calculate exact pending amount for 'abonos'
                            const { data: cobros } = await supabase
                                .from('Cobros')
                                .select('*')
                                .eq('cliente_id', clienteId);

                            let lastPaidInvoiceDate: string | null = null;

                            // 3. Apply Waterfall logic (FIFO)
                            for (const inv of facturas) {
                                if (remainingPayment <= 0) break;

                                const invPayments = (cobros || []).filter((c: any) => c.factura_id === inv.id);
                                const paidAmount = invPayments.reduce((sum: number, c: any) => sum + c.monto_pagado, 0);
                                const pendingAmount = inv.monto_total - paidAmount;

                                if (pendingAmount > 0) {
                                    const paymentApplied = Math.min(remainingPayment, pendingAmount);
                                    remainingPayment -= paymentApplied;

                                    // Insert Cobro
                                    await supabase.from('Cobros').insert([{
                                        cliente_id: clienteId,
                                        monto_pagado: paymentApplied,
                                        fecha_pago: new Date().toISOString().split('T')[0],
                                        metodo_pago: 'TiloPay (Tarjeta)',
                                        factura_id: inv.id,
                                        periodo_cubierto: inv.periodo || ''
                                    }]);

                                    // Update Factura estado
                                    const newStatus = paymentApplied >= pendingAmount ? 'pagada' : 'abono';
                                    await supabase.from('Facturas').update({ estado: newStatus }).eq('id', inv.id);

                                    if (newStatus === 'pagada') {
                                        lastPaidInvoiceDate = inv.fecha_emision;
                                    }
                                }
                            }

                            // 4. Update Cliente Fecha_Ultimo_Pago if an invoice was fully paid
                            if (lastPaidInvoiceDate) {
                                const { data: clientData } = await supabase.from('CLIENTES').select('Fecha_Ultimo_Pago').eq('id', clienteId).single();
                                const currentLastPaid = clientData?.Fecha_Ultimo_Pago ? new Date(`${clientData.Fecha_Ultimo_Pago}T00:00:00`) : new Date(0);
                                const newPaidDate = new Date(`${lastPaidInvoiceDate}T00:00:00`);

                                if (newPaidDate > currentLastPaid) {
                                    await supabase.from('CLIENTES').update({
                                        Fecha_Ultimo_Pago: lastPaidInvoiceDate
                                    }).eq('id', clienteId);
                                }
                            }
                        }
                    }
                }
            }

            // Redirect to success page
            return NextResponse.redirect(`${baseUrl}/portal/${placa}/payment-success?order=${orderNumber}`);
        } catch (error) {
            console.error('Error in TiloPay callback waterfall:', error);
            // Even if automation fails, the payment went through, so we still show success or a modified success.
            // For safety, let's redirect to success but maybe log the error heavily.
            return NextResponse.redirect(`${baseUrl}/portal/${placa}/payment-success?order=${orderNumber}&warning=automation_failed`);
        }
    } else {
        // Payment Declined or Error
        return NextResponse.redirect(`${baseUrl}/portal/${placa}?error=${description || 'payment_failed'}`);
    }
}
