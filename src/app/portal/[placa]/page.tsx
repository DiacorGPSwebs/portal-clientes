'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    FileText,
    CreditCard,
    ArrowLeft,
    Loader2,
    AlertCircle,
    CheckCircle2,
    Download,
    Wallet,
    Building2,
    Info,
    Car,
    Phone,
    X,
    ShieldCheck,
    Eye,
} from 'lucide-react';
import { getClientByPlate, createTiloPayPayment } from '@/lib/actions';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function PortalDashboard() {
    const { placa } = useParams();
    const router = useRouter();
    const [data, setData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [paymentAmountType, setPaymentAmountType] = useState<'full' | '60'>('full');
    const [isProcessingPayment, setIsProcessingPayment] = useState(false);

    // Invoice Preview State
    const [selectedFactura, setSelectedFactura] = useState<any>(null);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

    useEffect(() => {
        async function fetchData() {
            if (!placa) return;
            setIsLoading(true);
            try {
                const result = await getClientByPlate(placa as string);
                if (result.success) {
                    setData(result.data);
                } else {
                    setError(result.error || 'Error al cargar los datos');
                }
            } catch (err) {
                setError('Error de conexión');
            } finally {
                setIsLoading(false);
            }
        }
        fetchData();
    }, [placa]);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-brand-gradient flex items-center justify-center">
                <Loader2 className="animate-spin text-white" size={64} />
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="min-h-screen bg-brand-gradient text-white flex flex-col items-center justify-center p-6 text-center space-y-6">
                <div className="p-6 rounded-full bg-white/10 backdrop-blur-md text-white border border-white/20">
                    <AlertCircle size={64} />
                </div>
                <h1 className="text-3xl font-black uppercase italic tracking-tighter">¡Ups! Algo salió mal</h1>
                <p className="text-white/80 max-w-md font-medium">{error}</p>
                <button
                    onClick={() => router.push('/')}
                    className="bg-white text-[#00AEEF] px-8 py-4 rounded-xl font-black uppercase tracking-wider shadow-xl hover:scale-105 transition-transform flex items-center space-x-2"
                >
                    <ArrowLeft size={20} />
                    <span>Volver al inicio</span>
                </button>
            </div>
        );
    }

    const { cliente, vehiculo, vehiculos, totalDeuda, facturasPendientes } = data;

    const minAmount = totalDeuda * 0.6;
    const selectedAmount = paymentAmountType === 'full' ? totalDeuda : minAmount;

    const handleTiloPayPayment = async () => {
        setIsProcessingPayment(true);
        try {
            const result = await createTiloPayPayment({
                clienteId: cliente.id,
                monto: selectedAmount,
                placa: vehiculo.Placas,
                descripcion: `Pago ${paymentAmountType === 'full' ? 'Total' : 'Parcial 60%'} - ${vehiculo.Placas}`
            });

            if (result.success && result.url) {
                window.location.href = result.url;
            } else {
                alert(result.error || 'No se pudo generar el link de pago');
            }
        } catch (err) {
            alert('Error al conectar con la pasarela de pagos');
        } finally {
            setIsProcessingPayment(false);
        }
    };

    const handleDownloadPdf = async (fac: any) => {
        setIsGeneratingPdf(true);
        try {
            const jsPDF = (await import('jspdf')).default;
            const autoTable = (await import('jspdf-autotable')).default;
            const doc = new jsPDF();
            const date = format(new Date(fac.fecha_emision), 'dd/MM/yyyy');

            // Header - DIACOR BLUE
            doc.setFillColor(0, 174, 239);
            doc.rect(0, 0, 210, 40, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(24);
            doc.setFont('helvetica', 'bold');
            doc.text('DIACOR GPS', 14, 25);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text('Panamá, Rep. de Panamá', 14, 33);

            doc.setTextColor(255, 255, 255);
            doc.setFontSize(20);
            doc.text('FACTURA', 150, 25);
            doc.setFontSize(10);
            doc.text(`Número: ${fac.numero_factura}`, 150, 33);
            doc.text(`Fecha: ${date}`, 150, 37);

            // Client Info
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text('FACTURAR A:', 14, 55);
            doc.setFont('helvetica', 'normal');
            doc.text(cliente?.Nombre_Completo || 'Cliente General', 14, 60);
            doc.text(`Identificación: ${cliente?.RUC_Cedula || 'N/A'}`, 14, 65);
            doc.text(`Dirección: ${cliente?.Direccion || 'Panamá'}`, 14, 70);

            const monthName = format(new Date(fac.fecha_emision), 'MMMM', { locale: es });
            const year = format(new Date(fac.fecha_emision), 'yyyy');
            const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);

            const finalItems = fac.items && fac.items.length > 0 ? fac.items : [
                {
                    descripcion: `Mensualidad de servicio de rastreo GPS ${capitalizedMonth} ${year}`,
                    cantidad: (cliente?.Tarifa && cliente.Tarifa > 0) ? fac.monto_subtotal / cliente.Tarifa : (cliente?.Cantidad_Vehiculo || 1),
                    precio: cliente?.Tarifa || fac.monto_subtotal,
                    total: fac.monto_subtotal
                }
            ];

            const tableBody = finalItems.map((item: any) => [
                item.descripcion || item.description,
                item.cantidad || item.quantity,
                `$${Number(item.precio || item.price || 0).toFixed(2)}`,
                `$${Number(item.total || (item.cantidad * item.price) || 0).toFixed(2)}`
            ]);

            autoTable(doc, {
                startY: 80,
                head: [['Descripción', 'Cant.', 'Precio', 'Total']],
                body: tableBody,
                headStyles: { fillColor: [0, 174, 239], textColor: [255, 255, 255] },
                styles: { font: 'helvetica', fontSize: 9 }
            });

            const finalY = (doc as any).lastAutoTable.finalY + 10;
            doc.setFont('helvetica', 'normal');
            doc.text('Subtotal:', 140, finalY);
            doc.text(`$${fac.monto_subtotal.toFixed(2)}`, 190, finalY, { align: 'right' });
            doc.text('ITBMS (7%):', 140, finalY + 7);
            doc.text(`$${fac.monto_itbms.toFixed(2)}`, 190, finalY + 7, { align: 'right' });
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(12);
            doc.text('TOTAL:', 140, finalY + 16);
            doc.text(`$${fac.monto_total.toFixed(2)}`, 190, finalY + 16, { align: 'right' });

            // Footer
            doc.setFontSize(8);
            doc.setFont('helvetica', 'italic');
            doc.setTextColor(150, 150, 150);
            doc.text('Este documento es un comprobante de pago generado por el Portal de Clientes DIACOR.', 105, 280, { align: 'center' });

            doc.save(`Factura_${fac.numero_factura}.pdf`);
        } catch (err: any) {
            console.error('Error generating PDF:', err);
            alert('Error al generar el PDF. Por favor intenta de nuevo.');
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    function InvoicePreviewModal() {
        if (!isPreviewOpen || !selectedFactura) return null;

        const monthName = format(new Date(selectedFactura.fecha_emision), 'MMMM', { locale: es });
        const year = format(new Date(selectedFactura.fecha_emision), 'yyyy');
        const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);

        const items = selectedFactura.items && selectedFactura.items.length > 0 ? selectedFactura.items : [
            {
                description: `Mensualidad de servicio de rastreo GPS ${capitalizedMonth} ${year}`,
                quantity: (cliente?.Tarifa && cliente.Tarifa > 0) ? selectedFactura.monto_subtotal / cliente.Tarifa : (cliente?.Cantidad_Vehiculo || 1),
                price: cliente?.Tarifa || selectedFactura.monto_subtotal,
                total: selectedFactura.monto_subtotal
            }
        ];

        return (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-md animate-in fade-in duration-300">
                <div className="bg-white text-slate-900 w-full max-w-2xl max-h-[90vh] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in duration-300">
                    <div className="p-6 border-b flex justify-between items-center bg-gray-50/50">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-[#00AEEF]/10 flex items-center justify-center text-[#00AEEF]">
                                <Eye size={18} />
                            </div>
                            <h2 className="font-black uppercase italic tracking-tighter text-gray-700">Previa de Factura</h2>
                        </div>
                        <button onClick={() => setIsPreviewOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-8 md:p-12 text-left">
                        <div className="max-w-xl mx-auto space-y-8">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="text-3xl font-black text-[#00AEEF] tracking-tighter italic leading-none">DIACOR GPS</h3>
                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em] mt-2">Panamá, Rep. de Panamá</p>
                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.1em]">Email: info@diacorgps.com</p>
                                </div>
                                <div className="text-right">
                                    <h4 className="text-xl font-black text-gray-800 uppercase tracking-widest italic">Factura</h4>
                                    <p className="text-sm font-black text-[#00AEEF]">{selectedFactura.numero_factura}</p>
                                    <div className="mt-4 text-[9px] text-gray-400 uppercase font-black tracking-widest">Fecha de Emisión</div>
                                    <p className="text-sm font-bold text-gray-700">{format(new Date(selectedFactura.fecha_emision), 'dd MMMM, yyyy', { locale: es })}</p>
                                </div>
                            </div>

                            <div className="h-px bg-gray-100" />

                            <div className="grid grid-cols-2 gap-8">
                                <div>
                                    <p className="text-[9px] text-gray-400 uppercase font-black tracking-widest mb-2">Facturar a</p>
                                    <p className="font-black text-gray-800 text-lg leading-tight uppercase italic">{cliente.Nombre_Completo}</p>
                                    <p className="text-xs font-bold text-gray-400 mt-1">{cliente.RUC_Cedula || 'RUC/Cédula no registradas'}</p>
                                    <p className="text-xs font-bold text-gray-400 uppercase">{cliente.Direccion || 'Ciudad de Panamá, Panamá'}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[9px] text-gray-400 uppercase font-black tracking-widest mb-2">Estado</p>
                                    <span className="inline-block px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase bg-red-50 text-[#ED1C24] border border-red-100">
                                        Pendiente
                                    </span>
                                </div>
                            </div>

                            <div className="mt-10">
                                <table className="w-full text-left font-sans">
                                    <thead>
                                        <tr className="border-b-2 border-gray-900 text-[9px] font-black uppercase tracking-widest font-sans">
                                            <th className="pb-3 text-gray-400 font-black">Descripción</th>
                                            <th className="pb-3 text-center text-gray-400 w-16 font-black">Cant.</th>
                                            <th className="pb-3 text-right text-gray-400 w-24 font-black">Precio</th>
                                            <th className="pb-3 text-right text-gray-400 w-24 font-black">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50 border-b border-gray-100">
                                        {items.map((item: any, idx: number) => (
                                            <tr key={idx} className="text-sm">
                                                <td className="py-4 font-bold text-gray-700">{item.descripcion || item.description}</td>
                                                <td className="py-4 text-center text-gray-500 font-bold">{item.cantidad || item.quantity}</td>
                                                <td className="py-4 text-right text-gray-500 font-bold">${(item.precio || item.price || 0).toFixed(2)}</td>
                                                <td className="py-4 text-right font-black text-gray-800">${(item.total || (item.cantidad * item.price) || 0).toFixed(2)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="flex justify-end pt-6">
                                <div className="w-[200px] space-y-3">
                                    <div className="flex justify-between text-xs font-bold text-gray-400 uppercase tracking-widest">
                                        <span>Subtotal</span>
                                        <span className="text-gray-900 font-black">${selectedFactura.monto_subtotal?.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-xs font-bold text-gray-400 uppercase tracking-widest">
                                        <span>ITBMS (7%)</span>
                                        <span className="text-gray-900 font-black">${selectedFactura.monto_itbms?.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between pt-4 border-t-2 border-gray-900 mt-2">
                                        <span className="text-xs font-black uppercase tracking-[0.2em] text-gray-900">Total</span>
                                        <span className="text-2xl font-black italic tracking-tighter text-[#00AEEF] leading-none">${selectedFactura.monto_total?.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="p-8 bg-gray-50 border-t flex flex-col sm:flex-row justify-end gap-3 px-12">
                        <button onClick={() => setIsPreviewOpen(false)} className="px-8 py-4 rounded-xl text-xs font-black uppercase tracking-widest text-gray-400 hover:bg-gray-200 transition-all font-sans">
                            Cerrar
                        </button>
                        <button
                            disabled={isGeneratingPdf}
                            onClick={() => handleDownloadPdf(selectedFactura)}
                            className="px-10 py-4 rounded-xl bg-[#00AEEF] text-white text-xs font-black uppercase tracking-widest hover:bg-[#0088CC] transition-all shadow-xl shadow-cyan-500/20 flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50 font-sans"
                        >
                            {isGeneratingPdf ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                            <span>Descargar PDF</span>
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 text-gray-900 pb-20 font-sans">
            <header className="bg-brand-gradient text-white sticky top-0 z-20 shadow-lg px-6 py-4">
                <div className="max-w-6xl mx-auto flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <button
                            onClick={() => router.push('/')}
                            className="p-2 hover:bg-white/10 rounded-lg transition-colors border border-white/10"
                        >
                            <ArrowLeft size={24} />
                        </button>
                        <div>
                            <h2 className="font-black italic text-xl leading-none">DIACOR GPS</h2>
                            <p className="text-[10px] uppercase tracking-widest font-bold text-white/70">Portal de Clientes</p>
                        </div>
                    </div>

                    <div className="hidden md:flex bg-white/10 rounded-xl px-4 py-2 items-center space-x-3 border border-white/10">
                        <Building2 size={16} className="text-white/70" />
                        <span className="text-sm font-bold truncate max-w-[200px]">{cliente.Nombre_Completo}</span>
                    </div>

                    <div className="flex bg-white/10 rounded-xl px-4 py-2 items-center space-x-3 border border-white/10">
                        <Car size={20} className="text-white" />
                        <span className="text-lg font-black italic tracking-tighter">{vehiculo.Placas}</span>
                    </div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div className="space-y-1">
                        <h1 className="text-3xl md:text-4xl font-black text-gray-900 tracking-tight uppercase leading-tight">
                            Hola, <span className="text-[#00AEEF]">{cliente.Nombre_Completo}</span>
                        </h1>
                        <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Consulta tu estado de cuenta y revisa tus vehículos</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                    <div className="lg:col-span-2 space-y-10">
                        <section className="relative overflow-hidden rounded-[2.5rem] bg-brand-gradient p-10 text-white shadow-2xl shadow-cyan-500/20">
                            <div className="relative z-10 space-y-4">
                                <span className="text-white/70 font-black uppercase tracking-[0.2em] text-xs flex items-center gap-2">
                                    <CreditCard size={16} />
                                    Saldo Total Pendiente
                                </span>
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                    <div className="flex items-baseline gap-3">
                                        <span className="text-6xl md:text-8xl font-black italic tracking-tighter">$ {totalDeuda.toFixed(2)}</span>
                                        <span className="text-2xl font-black opacity-50 italic">USD</span>
                                    </div>

                                    {totalDeuda > 0 && (
                                        <button
                                            onClick={() => setIsPaymentModalOpen(true)}
                                            className="bg-white text-[#00AEEF] px-10 py-5 rounded-[2rem] font-black uppercase tracking-widest shadow-2xl hover:scale-105 transition-transform flex items-center justify-center space-x-3 active:scale-95 group"
                                        >
                                            <ShieldCheck size={24} className="group-hover:rotate-12 transition-transform" />
                                            <span>Pagar Ahora</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="absolute right-10 top-1/2 -translate-y-1/2 opacity-10">
                                <FileText size={180} />
                            </div>
                        </section>

                        <div className="space-y-8">
                            <h2 className="text-xl font-black uppercase italic tracking-tighter flex items-center gap-3 text-gray-800">
                                <div className="w-8 h-8 rounded-lg bg-[#00AEEF]/10 flex items-center justify-center text-[#00AEEF]">
                                    <FileText size={20} />
                                </div>
                                Facturas Pendientes
                            </h2>

                            <div className="space-y-4">
                                {facturasPendientes.length > 0 ? (
                                    facturasPendientes.map((inv: any) => (
                                        <div key={inv.id} className="bg-white border-2 border-gray-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
                                            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-3">
                                                        <span className="font-black italic text-xl tracking-tighter text-gray-900">{inv.numero_factura}</span>
                                                        <span className="text-[9px] uppercase font-black bg-red-100 text-[#ED1C24] px-2 py-1 rounded tracking-widest">
                                                            Pendiente
                                                        </span>
                                                    </div>
                                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                                        Vence el {format(new Date(inv.fecha_vencimiento), "d MMM, yyyy", { locale: es })}
                                                    </p>
                                                </div>
                                                <div className="text-left sm:text-right">
                                                    <span className="text-2xl font-black italic tracking-tighter text-[#00AEEF]">$ {inv.monto_pendiente.toFixed(2)}</span>
                                                </div>
                                            </div>

                                            <div className="mt-4 flex items-center justify-between border-t border-gray-50 pt-4">
                                                <span className="text-[10px] font-black uppercase text-gray-300 tracking-widest tracking-tighter">Total original: ${inv.monto_total.toFixed(2)}</span>
                                                <button
                                                    onClick={() => { setSelectedFactura(inv); setIsPreviewOpen(true); }}
                                                    className="flex items-center space-x-2 text-xs font-black uppercase tracking-wider text-[#00AEEF] hover:text-[#0088CC]"
                                                >
                                                    <Download size={14} />
                                                    <span>Descargar PDF</span>
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="bg-white border-2 border-dashed border-gray-200 rounded-[2rem] p-16 text-center space-y-3">
                                        <CheckCircle2 size={48} className="mx-auto text-green-500 opacity-20" />
                                        <h3 className="text-lg font-black italic uppercase">Sin deudas</h3>
                                        <p className="text-gray-400 italic text-sm">Tu cuenta se encuentra totalmente al día.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-10">
                        <div className="space-y-6">
                            <div className="flex items-center justify-between px-1">
                                <h2 className="text-xl font-black uppercase italic tracking-tighter flex items-center gap-3 text-gray-800">
                                    <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500">
                                        <Car size={20} />
                                    </div>
                                    Mis Vehículos
                                </h2>
                                <div className="bg-gray-100 px-3 py-1 rounded-full border border-gray-200 shadow-inner flex items-center gap-2">
                                    <span className="text-[10px] font-black uppercase text-gray-400 tracking-tighter">Total:</span>
                                    <span className="text-sm font-black text-[#00AEEF]">{vehiculos.length}</span>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 gap-3">
                                {vehiculos.map((v: any) => (
                                    <button
                                        key={v.id}
                                        onClick={() => v.Placas !== vehiculo.Placas && router.push(`/portal/${v.Placas}`)}
                                        className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all group relative overflow-hidden ${v.Placas === vehiculo.Placas
                                            ? 'bg-[#00AEEF]/5 border-[#00AEEF] shadow-sm shadow-[#00AEEF]/10'
                                            : 'bg-white border-gray-100 hover:border-gray-200 hover:shadow-md'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${v.Placas === vehiculo.Placas ? 'bg-[#00AEEF] text-white' : 'bg-gray-50 text-gray-400 group-hover:bg-gray-100'
                                                }`}>
                                                <Car size={20} />
                                            </div>
                                            <div className="text-left">
                                                <p className={`font-black italic tracking-tighter text-lg leading-none ${v.Placas === vehiculo.Placas ? 'text-[#00AEEF]' : 'text-gray-900'
                                                    }`}>
                                                    {v.Placas}
                                                </p>
                                                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                                                    {v.Marca} {v.Modelo}
                                                </p>
                                            </div>
                                        </div>
                                        {v.Placas === vehiculo.Placas && (
                                            <div className="text-[#00AEEF] bg-[#00AEEF]/10 p-1 rounded-full">
                                                <CheckCircle2 size={16} />
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-8">
                            <h2 className="text-xl font-black uppercase italic tracking-tighter flex items-center gap-3 text-gray-800">
                                <div className="w-8 h-8 rounded-lg bg-[#ED1C24]/10 flex items-center justify-center text-[#ED1C24]">
                                    <Wallet size={20} />
                                </div>
                                Métodos de Pago
                            </h2>

                            <div className="bg-white border-2 border-gray-100 rounded-[2rem] p-8 space-y-8">
                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <h4 className="text-xs font-black uppercase tracking-widest text-[#00AEEF]">Banco General</h4>
                                        <div className="bg-gray-50 rounded-xl p-4 space-y-1">
                                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Rastrealogps S.A.</p>
                                            <p className="text-xs font-black">Cuenta Corriente</p>
                                            <p className="text-lg font-black italic tracking-tighter text-gray-900">03-12-01-123456-7</p>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <h4 className="text-xs font-black uppercase tracking-widest text-orange-500">Yappy</h4>
                                        <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
                                            <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest mb-1">Buscar en directorio:</p>
                                            <p className="text-xl font-black italic text-orange-600">@DIACORGPS</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-6 border-t border-gray-50 flex flex-col items-center space-y-4 text-left">
                                    <p className="text-[10px] text-gray-400 font-bold text-center uppercase leading-relaxed tracking-wider">
                                        Envía el comprobante para validar tu pago
                                    </p>
                                    <a
                                        href="https://wa.me/50764712589"
                                        target="_blank"
                                        className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white py-4 rounded-xl font-black uppercase tracking-widest text-xs flex items-center justify-center space-x-2 transition-all shadow-lg active:scale-95"
                                    >
                                        <Phone size={16} />
                                        <span>WhatsApp Soporte</span>
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Modals */}
            {isPaymentModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-gray-900/40 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden relative animate-in zoom-in duration-300">
                        <button
                            onClick={() => setIsPaymentModalOpen(false)}
                            className="absolute top-6 right-6 p-2 rounded-full bg-gray-50 text-gray-400 hover:text-gray-900 transition-colors"
                        >
                            <X size={20} />
                        </button>

                        <div className="p-10 space-y-10 text-left">
                            <div className="space-y-2">
                                <h3 className="text-3xl font-black italic uppercase tracking-tighter text-gray-900 leading-none">
                                    Finalizar<br /><span className="text-[#00AEEF]">Tu Pago</span>
                                </h3>
                                <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">Elige el monto y el método de pago</p>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                <button
                                    onClick={() => setPaymentAmountType('full')}
                                    className={`p-6 rounded-2xl border-2 flex items-center justify-between transition-all ${paymentAmountType === 'full'
                                        ? 'border-[#0088CC] bg-[#00AEEF]/5'
                                        : 'border-gray-100 hover:border-gray-200'
                                        }`}
                                >
                                    <div className="text-left">
                                        <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1">Total de la Deuda</p>
                                        <p className="text-2xl font-black italic tracking-tighter text-gray-900">$ {totalDeuda.toFixed(2)}</p>
                                    </div>
                                    <div className={`w-6 h-6 rounded-full border-4 flex items-center justify-center ${paymentAmountType === 'full' ? 'border-[#0088CC]' : 'border-gray-100'
                                        }`}>
                                        {paymentAmountType === 'full' && <div className="w-2.5 h-2.5 rounded-full bg-[#0088CC]" />}
                                    </div>
                                </button>

                                <button
                                    onClick={() => setPaymentAmountType('60')}
                                    className={`p-6 rounded-2xl border-2 flex items-center justify-between transition-all ${paymentAmountType === '60'
                                        ? 'border-[#0088CC] bg-[#00AEEF]/5'
                                        : 'border-gray-100 hover:border-gray-200'
                                        }`}
                                >
                                    <div className="text-left">
                                        <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1">Mínimo para reconexión (60%)</p>
                                        <p className="text-2xl font-black italic tracking-tighter text-gray-900">$ {minAmount.toFixed(2)}</p>
                                    </div>
                                    <div className={`w-6 h-6 rounded-full border-4 flex items-center justify-center ${paymentAmountType === '60' ? 'border-[#0088CC]' : 'border-gray-100'
                                        }`}>
                                        {paymentAmountType === '60' && <div className="w-2.5 h-2.5 rounded-full bg-[#0088CC]" />}
                                    </div>
                                </button>
                            </div>

                            <div className="space-y-4 pt-6 border-t border-gray-50 font-sans">
                                <button
                                    disabled={isProcessingPayment}
                                    onClick={handleTiloPayPayment}
                                    className="w-full bg-[#00AEEF] hover:bg-[#0088CC] text-white py-5 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center space-x-3 shadow-xl transition-all active:scale-95 disabled:opacity-50"
                                >
                                    {isProcessingPayment ? <Loader2 size={20} className="animate-spin" /> : <CreditCard size={20} />}
                                    <span>Pagar con Tarjeta</span>
                                </button>

                                <a
                                    href={`https://wa.me/50764712589?text=Hola,%20quiero%20pagar%20mi%20deuda%20de%20$${selectedAmount.toFixed(2)}%20(Placa%20${vehiculo.Placas})%20por%20Yappy`}
                                    target="_blank"
                                    className="w-full bg-[#FA6400] hover:bg-[#E55B00] text-white py-5 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center space-x-3 shadow-xl transition-all active:scale-95"
                                >
                                    <Wallet size={20} />
                                    <span>Yappy - @DIACORGPS</span>
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <InvoicePreviewModal />

            <footer className="max-w-6xl mx-auto px-6 pt-10 border-t border-gray-100 text-center opacity-30">
                <p className="text-[9px] font-black uppercase tracking-[0.5em]">DIACOR GPS • PANAMÁ</p>
            </footer>
        </div>
    );
}
