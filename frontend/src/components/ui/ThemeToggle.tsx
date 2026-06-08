'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface Props {
  className?: string;
}

// ─── ThemeToggle ───────────────────────────────────────────────────────────────
//
// Lee el estado real del modo oscuro directamente desde el DOM (<html class="dark">)
// mediante un MutationObserver.  Esto evita el desync de hidratación de next-themes
// 0.4.x, donde React state puede quedar en "light"/"undefined" aunque el DOM ya
// tenga class="dark" (aplicado por el script inline de next-themes antes de hidratar).
//
// Flujo:
//   1. useEffect lee document.documentElement.classList.contains('dark') → isDark
//   2. MutationObserver actualiza isDark en tiempo real cuando next-themes cambia la clase
//   3. Al hacer clic se llama setTheme() (next-themes) + actualización optimista local

export function ThemeToggle({ className }: Props) {
  const { setTheme } = useTheme();
  const [isDark,  setIsDark]  = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Leer el estado real del DOM (ya fue aplicado por el script inline de next-themes)
    const root = document.documentElement;
    setIsDark(root.classList.contains('dark'));
    setMounted(true);

    // Observar cambios futuros en class="..." del elemento <html>
    const observer = new MutationObserver(() => {
      setIsDark(root.classList.contains('dark'));
    });
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });

    return () => observer.disconnect();
  }, []);

  // Skeleton del mismo tamaño → evita layout shift (CLS)
  if (!mounted) {
    return (
      <div
        className={cn(
          'h-9 w-36 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse',
          className,
        )}
        aria-hidden
      />
    );
  }

  const handleToggle = () => {
    const next = isDark ? 'light' : 'dark';
    // Actualización optimista inmediata (el MutationObserver también la captura)
    setIsDark(!isDark);
    setTheme(next);
  };

  return (
    <button
      onClick={handleToggle}
      aria-label={isDark ? 'Cambiar a modo día' : 'Cambiar a modo noche'}
      className={cn(
        // Base
        'inline-flex items-center gap-2 px-4 py-2 rounded-full',
        'text-sm font-semibold select-none',
        'border transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-offset-2',
        // Modo noche activo → botón para ir a día
        isDark && [
          'bg-slate-700 border-slate-600 text-amber-300',
          'hover:bg-slate-600 hover:border-slate-500',
          'focus:ring-amber-400 focus:ring-offset-slate-900',
        ],
        // Modo día activo → botón para ir a noche
        !isDark && [
          'bg-slate-100 border-slate-200 text-slate-700',
          'hover:bg-slate-200 hover:border-slate-300',
          'focus:ring-slate-400',
        ],
        className,
      )}
    >
      <span className="text-base leading-none" aria-hidden>
        {isDark ? '☀️' : '🌙'}
      </span>
      <span>{isDark ? 'Modo Día' : 'Modo Noche'}</span>
    </button>
  );
}
