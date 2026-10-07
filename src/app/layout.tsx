import type { Metadata, Viewport } from "next";
import { Nav } from "@/components/Nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Liquidación de repartidores",
  description: "Totales y liquidación mensual a partir de chats de WhatsApp",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-gray-50 pb-20 text-gray-900 md:pb-0">
        <Nav />
        <main className="mx-auto max-w-5xl px-4 py-5 md:py-8">{children}</main>
      </body>
    </html>
  );
}
