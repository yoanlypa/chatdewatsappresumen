import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Liquidación de repartidores",
  description: "Totales y liquidación mensual a partir de chats de WhatsApp",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-gray-50 text-gray-900">{children}</body>
    </html>
  );
}
