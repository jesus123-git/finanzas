import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { type ReactNode } from 'react';
import { AuthProvider } from '@/context/auth.context';
import { ThemeProvider } from '@/components/ui/ThemeProvider';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: { default: 'Finanzas', template: '%s | Finanzas' },
  description: 'Gestiona tus finanzas personales con claridad',
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
          ${inter.variable} font-sans antialiased
          bg-slate-50 dark:bg-slate-950
          text-slate-900 dark:text-slate-100
        `}
      >
        <ThemeProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
