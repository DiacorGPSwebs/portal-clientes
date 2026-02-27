'use server';
import { supabase } from './supabase';

const TILOPAY_API_USER = process.env.TILOPAY_API_USER;
const TILOPAY_PASSWORD = process.env.TILOPAY_PASSWORD;
const TILOPAY_KEY = process.env.TILOPAY_KEY;
const TILOPAY_BASE_URL = process.env.TILOPAY_BASE_URL || 'https://app.tilopay.com/api/v1';
const NEXT_PUBLIC_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001';

async function getTiloPayToken() {
    try {
        const response = await fetch(`${TILOPAY_BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                apiuser: TILOPAY_API_USER,
                password: TILOPAY_PASSWORD
            })
        });

        const data = await response.json();
        if (data.access_token) return data.access_token;
        throw new Error('No se pudo obtener el token de TiloPay');
    } catch (error) {
        console.error('Error getting TiloPay token:', error);
        return null;
    }
}

export async function createTiloPayPayment(params: {
    clienteId: string;
    monto: number;
    placa: string;
    descripcion: string;
}) {
    try {
        const { clienteId, monto, placa, descripcion } = params;

        // 1. Get Client Info for billing
        const { data: client, error: cError } = await supabase
            .from('CLIENTES')
            .select('*')
            .eq('id', clienteId)
            .single();

        if (cError || !client) throw new Error('Cliente no encontrado para facturación');

        // 2. Auth with TiloPay
        const token = await getTiloPayToken();
        if (!token) return { success: false, error: 'Error de autenticación con la pasarela' };

        // 3. Prepare TiloPay Request
        const orderNumber = `O-${Date.now()}-${placa}`;
        const names = (client.Nombre_Completo || 'Cliente').split(' ');
        const firstName = names[0];
        const lastName = names.slice(1).join(' ') || 'Diacor';

        const payload = {
            amount: monto.toFixed(2),
            currency: 'USD',
            redirect: `${NEXT_PUBLIC_BASE_URL}/api/payment/tilopay/callback?placa=${placa}&order=${orderNumber}`,
            key: TILOPAY_KEY,
            billToFirstName: firstName,
            billToLastName: lastName,
            billToAddress: client.Direccion || 'Ciudad de Panamá',
            billToCity: 'Panamá',
            billToState: 'PA-8',
            billToZipPostCode: '00000', // ZIP must be 5 digits for some gateways
            billToCountry: 'PA',
            billToTelephone: '50788888888', // Ensure international format
            billToEmail: client.Correo || 'soporte@diacor.com',
            shipToFirstName: firstName,
            shipToLastName: lastName,
            shipToAddress: client.Direccion || 'Ciudad de Panamá',
            shipToCity: 'Panamá',
            shipToState: 'PA-8',
            shipToZipPostCode: '00000',
            shipToCountry: 'PA',
            shipToTelephone: '50788888888',
            shipToEmail: client.Correo || 'soporte@diacor.com',
            orderNumber: orderNumber,
            capture: '1',
            token_version: 'v2'
        };

        // 4. Generate Payment Hash/Session
        const response = await fetch(`${TILOPAY_BASE_URL}/processPayment`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (result.url) {
            return {
                success: true,
                url: result.url,
                orderNumber: orderNumber
            };
        }

        // Detailed logging for Vercel
        console.error('--- TiloPay API Error ---');
        console.error('Status:', response.status);
        console.error('Payload Sent:', { ...payload, key: '***' }); // Hide key in logs
        console.error('Response:', JSON.stringify(result, null, 2));
        console.error('--------------------------');

        return {
            success: false,
            error: result.description || `Error de TiloPay: ${result.code || 'Desconocido'}`
        };

    } catch (error: any) {
        console.error('--- Critical Error in createTiloPayPayment ---');
        console.error(error);
        return { success: false, error: 'Error interno al comunicarse con la pasarela' };
    }
}

export async function getClientByPlate(plate: string) {
    try {
        const formattedPlate = plate.trim().toUpperCase();
        console.log('Searching for plate:', formattedPlate);

        // 1. Find Vehicle
        const { data: vehicle, error: vError } = await supabase
            .from('Vehiculos')
            .select('id, Placas, Usuario_ID')
            .eq('Placas', formattedPlate)
            .single();

        if (vError || !vehicle) {
            console.log('Vehicle not found:', vError);
            return { success: false, error: 'Placa no encontrada' };
        }

        // 2. Find User
        const { data: user, error: uError } = await supabase
            .from('Usuarios')
            .select('id, CLIENTE_ID')
            .eq('id', vehicle.Usuario_ID)
            .single();

        if (uError || !user || !user.CLIENTE_ID) {
            console.log('User or CLIENTE_ID error:', uError, user);
            return { success: false, error: 'Usuario no vinculado a un cliente' };
        }

        // 3. Find Client
        const { data: client, error: cError } = await supabase
            .from('CLIENTES')
            .select('*')
            .eq('id', user.CLIENTE_ID)
            .single();

        if (cError || !client) {
            console.log('Client not found:', cError);
            return { success: false, error: 'Cliente no encontrado' };
        }

        // 4. Fetch Invoices with Items
        const { data: invoices, error: iError } = await supabase
            .from('Facturas')
            .select(`
                *,
                Cotizaciones (
                    items,
                    numero_cotizacion
                )
            `)
            .eq('cliente_id', client.id)
            .order('fecha_emision', { ascending: false });

        // 5. Fetch Payments
        const { data: payments, error: pError } = await supabase
            .from('Cobros')
            .select('*')
            .eq('cliente_id', client.id);

        // Calculate pending amount for each invoice
        const invoicesWithStatus = (invoices || []).map(inv => {
            const invPayments = (payments || []).filter(p => p.factura_id === inv.id);
            const paidAmount = invPayments.reduce((sum, p) => sum + p.monto_pagado, 0);
            const pendingAmount = inv.monto_total - paidAmount;

            return {
                ...inv,
                monto_pagado: paidAmount,
                monto_pendiente: Math.max(0, pendingAmount),
                estado_calculado: pendingAmount <= 0 ? 'pagada' : (paidAmount > 0 ? 'abono' : 'pendiente')
            };
        }).filter(inv => inv.monto_pendiente > 0);

        const totalDeuda = invoicesWithStatus.reduce((sum, inv) => sum + inv.monto_pendiente, 0);

        // 6. Fetch All Vehicles for this Client
        // First find all users associated with this client
        const { data: clientUsers, error: cuError } = await supabase
            .from('Usuarios')
            .select('id')
            .eq('CLIENTE_ID', client.id);

        let allVehicles: any[] = [];
        if (clientUsers && clientUsers.length > 0) {
            const userIds = clientUsers.map(u => u.id);
            const { data: vehicles, error: vsError } = await supabase
                .from('Vehiculos')
                .select('*')
                .in('Usuario_ID', userIds);

            if (vehicles) {
                allVehicles = vehicles;
            }
        }

        return {
            success: true,
            data: {
                cliente: {
                    id: client.id,
                    Nombre_Completo: client.Nombre_Completo,
                    Correo: client.Correo,
                },
                vehiculo: {
                    Placas: vehicle.Placas,
                },
                vehiculos: allVehicles.map(v => ({
                    id: v.id,
                    Placas: v.Placas,
                    Marca: v.Marca,
                    Modelo: v.Modelo,
                    Anio: v.Anio
                })),
                totalDeuda,
                facturasPendientes: invoicesWithStatus
            }
        };
    } catch (error: any) {
        console.error('Error in getClientByPlate:', error);
        return { success: false, error: 'Error del servidor' };
    }
}
