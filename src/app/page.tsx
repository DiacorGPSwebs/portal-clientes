'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, FileText } from 'lucide-react';
import { getClientByPlate } from '@/lib/actions';

export default function LandingPage() {
    const [plate, setPlate] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!plate.trim()) return;

        setIsLoading(true);
        setError(null);

        try {
            const result = await getClientByPlate(plate);
            if (result.success) {
                router.push(`/portal/${plate.trim().toUpperCase()}`);
            } else {
                setError(result.error || 'No se pudo encontrar la placa');
            }
        } catch (err) {
            setError('Ocurrió un error inesperado');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <main className="min-h-screen bg-brand-gradient flex items-center justify-center p-4 md:p-10 font-sans">
            <div className="w-full max-w-[480px] bg-white rounded-[2.5rem] shadow-2xl p-8 md:p-12 flex flex-col items-center animate-in fade-in zoom-in duration-500">

                {/* Logo Section */}
                <div className="mb-6">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src="/logo.png"
                        alt="Diacor GPS"
                        className="h-24 md:h-28 object-contain"
                    />
                </div>

                <div className="text-center mb-10 space-y-2">
                    <h1 className="text-3xl md:text-4xl font-black text-[#00AEEF] tracking-tight">
                        PORTAL DE CLIENTES
                    </h1>
                    <p className="text-gray-500 font-bold text-lg leading-tight">
                        Consulta tu estado de cuenta de forma rápida y segura
                    </p>
                </div>

                <form onSubmit={handleSearch} className="w-full space-y-8">
                    <div className="space-y-3">
                        <label className="block text-sm font-bold text-gray-700 uppercase tracking-widest px-1">
                            Placa del Vehículo
                        </label>
                        <input
                            type="text"
                            placeholder="Ej: 868045"
                            value={plate}
                            onChange={(e) => setPlate(e.target.value.toUpperCase())}
                            className="w-full bg-gray-50 border-2 border-gray-100 focus:border-[#00AEEF] focus:bg-white outline-none rounded-xl py-4 px-6 text-lg font-bold text-gray-800 transition-all placeholder:text-gray-300 placeholder:font-normal"
                            autoFocus
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading || !plate.trim()}
                        className="w-full bg-[#ED1C24] hover:bg-[#D1181F] disabled:opacity-50 text-white py-4 rounded-xl font-black text-lg flex items-center justify-center space-x-3 transition-all shadow-lg shadow-red-500/20 active:scale-95"
                    >
                        {isLoading ? (
                            <Loader2 className="animate-spin" size={24} />
                        ) : (
                            <>
                                <FileText size={22} />
                                <span className="uppercase tracking-wider">Ver Estado de Cuenta</span>
                            </>
                        )}
                    </button>
                </form>

                {error && (
                    <div className="mt-6 text-[#ED1C24] font-bold text-sm bg-red-50 px-4 py-2 rounded-lg border border-red-100 flex items-center space-x-2">
                        <span>⚠️</span>
                        <span>{error}</span>
                    </div>
                )}

                <div className="mt-12 pt-8 w-full border-t border-gray-100 flex flex-col items-center space-y-3">
                    <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest text-center leading-relaxed">
                        Plaza las Pirámides Local 1<br />
                        Tel: 6471-2589 | RUC: 2216867-1-775831 DV1
                    </div>
                </div>
            </div>
        </main>
    );
}
