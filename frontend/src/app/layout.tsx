import type { Metadata } from 'next';
import { Manrope, Sora } from 'next/font/google';
import { type ReactNode } from 'react';
import { AuthProvider } from '@/context/auth.context';
import { ThemeProvider } from '@/components/ui/ThemeProvider';
import { QueryProvider } from '@/components/ui/QueryProvider';
import './globals.css';

// ─── Tipografía NOMI ──────────────────────────────────────────────────────────
// Manrope → cuerpo: corporativa, cálida, excelente legibilidad en cifras.
// Sora    → titulares y marca: geométrica, elegante, con carácter propio.
const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope' });
const sora    = Sora({ subsets: ['latin'], variable: '--font-sora', weight: ['400', '600', '700', '800'] });

export const metadata: Metadata = {
  title: { default: 'NOMI — Finanzas con claridad', template: '%s | NOMI' },
  description: 'NOMI: la plataforma financiera para personas y negocios en Colombia',
};

// ─── RootLayout ────────────────────────────────────────────────────────────────
//
// Orden de providers (exterior → interior):
//   ThemeProvider  → inyecta .dark/.light en <html>
//   AuthProvider   → gestiona JWT + estado de usuario
//   {children}     → páginas/layouts anidados
//
// suppressHydrationWarning en <html> es obligatorio con next-themes:
// el servidor no conoce el tema almacenado en localStorage del cliente,
// por lo que el atributo class puede diferir en la hidratación.
// Next.js suprime el warning en ese elemento específico.

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`
          ${manrope.variable} ${sora.variable} font-sans antialiased
          bg-white dark:bg-slate-950
          text-slate-900 dark:text-slate-100
        `}
      >
        <ThemeProvider>
          <QueryProvider>
            <AuthProvider>
              {children}
            </AuthProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
