'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, ArrowLeft, Download, Building2, Car, Printer } from 'lucide-react';

export default function PaymentSuccess() {
    const { placa } = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const orderNumber = searchParams.get('order');

    return (
        <div className="min-h-screen bg-brand-gradient flex items-center justify-center p-6">
            <div className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-500">
                {/* Success Header */}
                <div className="bg-[#25D366]/10 p-10 text-center space-y-4">
                    <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-[#25D366]/20 text-[#25D366]">
                        <CheckCircle2 size={64} strokeWidth={3} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black italic uppercase tracking-tighter text-gray-900 leading-none">
                            Pago<br /><span className="text-[#25D366]">Completado</span>
                        </h1>
                        <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px] mt-2">Tu transacción se procesó con éxito</p>
                    </div>
                </div>

                {/* Receipt Details */}
                <div className="p-8 space-y-6">
                    <div className="bg-gray-50 rounded-2xl p-6 border-2 border-dashed border-gray-100 space-y-4">
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-gray-400 font-black uppercase tracking-widest">Orden No.</span>
                            <span className="font-black italic text-gray-900">{orderNumber}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-gray-400 font-black uppercase tracking-widest">Vehículo</span>
                            <div className="flex items-center gap-2">
                                <Car size={14} className="text-[#00AEEF]" />
                                <span className="font-black italic text-gray-900">{placa}</span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3 pt-4">
                        <button
                            onClick={() => window.print()}
                            className="w-full bg-[#00AEEF]/5 hover:bg-[#00AEEF]/10 text-[#00AEEF] py-4 rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center space-x-2 transition-all"
                        >
                            <Printer size={16} />
                            <span>Imprimir Comprobante</span>
                        </button>

                        <button
                            onClick={() => router.push(`/portal/${placa}`)}
                            className="w-full bg-brand-gradient text-white py-5 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center space-x-2 shadow-xl hover:scale-105 transition-all active:scale-95"
                        >
                            <ArrowLeft size={18} />
                            <span>Volver al Dashboard</span>
                        </button>
                    </div>
                </div>

                <div className="p-4 bg-gray-50 text-center border-t border-gray-100">
                    <p className="text-[8px] font-black uppercase tracking-[0.3em] text-gray-300">DIACOR GPS • SEGURIDAD TOTAL</p>
                </div>
            </div>
        </div>
    );
}
