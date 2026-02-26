import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "Portal de Clientes - Consulta tu Deuda",
    description: "Consulta tus facturas pendientes y gestiona tus pagos de forma rápida y segura.",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="es" className="dark">
            <body className="antialiased">
                {children}
            </body>
        </html>
    );
}
