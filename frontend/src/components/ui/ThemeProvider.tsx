'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { ReactNode } from 'react';

// ─── ThemeProvider ─────────────────────────────────────────────────────────────
//
// Wrapper con 'use client' sobre next-themes (requerido por Next.js App Router).
// next-themes 0.4.x exporta su ThemeProvider como client component internamente,
// pero Next.js requiere que el PRIMER punto de entrada sea un archivo con
// 'use client' explícito cuando se usa en un server component (layout.tsx).
//
// attribute="class" → Tailwind darkMode: 'class' requiere este atributo.
// defaultTheme="light" → arranca en modo día por defecto.
// enableSystem={false} → el usuario elige explícitamente desde el botón de la UI.

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
