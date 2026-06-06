import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// next/font descarga la fuente en build-time → sin layout shift ni petición externa
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Finanzas",
  description: "Gestión de finanzas personales",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className={`${inter.variable} antialiased`}>{children}</body>
    </html>
  );
}
