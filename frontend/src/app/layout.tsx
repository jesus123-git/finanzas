import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { AuthProvider } from '@/context/auth.context';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: { default: 'Finanzas', template: '%s | Finanzas' },
  description: 'Gestiona tus finanzas personales con claridad',
};

// RootLayout envuelve TODA la app con AuthProvider.
// Cualquier componente hijo puede llamar useAuth() sin necesidad
// de prop-drilling. El 'use client' de AuthProvider no contamina
// este Server Component — Next.js los separa automáticamente.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${inter.variable} font-sans antialiased bg-slate-50 text-slate-900`}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
