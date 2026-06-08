'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { ReactNode } from 'react';

// ─── ThemeProvider ─────────────────────────────────────────────────────────────
//
// Wrapper delgado sobre next-themes.  Inyecta la clase 'dark' o la quita de
// <html> según la preferencia del usuario, que se persiste en localStorage.
//
// Uso: envuelve <AuthProvider> en layout.tsx para que TODA la app tenga acceso
// al tema sin necesidad de prop-drilling.
//
// attribute="class" → Tailwind darkMode: 'class' requiere este atributo.
// defaultTheme="light" → arranca en modo día por defecto.
// enableSystem={false} → no hereda la preferencia del sistema operativo;
//   el usuario elige explícitamente desde el botón de la UI.

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange={false}
      storageKey="finanzas-theme"
    >
      {children}
    </NextThemesProvider>
  );
}
