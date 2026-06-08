'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface Props {
  className?: string;
}

// ─── ThemeToggle ───────────────────────────────────────────────────────────────
//
// Botón con texto visible que alterna entre modo día y modo noche.
// Muestra el DESTINO del cambio (lo que ocurrirá al hacer clic):
//   • En modo día  → "🌙 Modo Noche"
//   • En modo noche → "☀️ Modo Día"
//
// Patrón `mounted`:  next-themes hidrata DESPUÉS del primer render del servidor,
// así que durante la hidratación el tema es desconocido.  Mostramos un skeleton
// del mismo tamaño para evitar el layout shift.

export function ThemeToggle({ className }: Props) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Placeholder del mismo ancho/alto que el botón real → evita CLS
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

  const isDark = theme === 'dark';

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Cambiar a modo día' : 'Cambiar a modo noche'}
      className={cn(
        // Base
        'inline-flex items-center gap-2 px-4 py-2 rounded-full',
        'text-sm font-semibold select-none',
        'border transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-offset-2',
        // Modo día → botón para ir a noche
        !isDark && [
          'bg-slate-100 border-slate-200 text-slate-700',
          'hover:bg-slate-200 hover:border-slate-300',
          'focus:ring-slate-400',
        ],
        // Modo noche → botón para ir a día
        isDark && [
          'bg-slate-700 border-slate-600 text-amber-300',
          'hover:bg-slate-600 hover:border-slate-500',
          'focus:ring-amber-400 focus:ring-offset-slate-900',
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
