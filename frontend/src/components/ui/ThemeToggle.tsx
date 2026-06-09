'use client';

import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'finanzas-theme';

/** Lee el tema actual desde localStorage (fuente de verdad de next-themes) */
function readThemeFromStorage(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'dark';
  } catch {
    return document.documentElement.classList.contains('dark');
  }
}

interface Props {
  className?: string;
}

export function ThemeToggle({ className }: Props) {
  const [isDark,  setIsDark]  = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const readDark = () => root.classList.contains('dark');

    // 1. Montar observer ANTES de leer el estado inicial,
    //    para no perder cambios que ocurran entre la lectura y el render.
    const observer = new MutationObserver(() => setIsDark(readDark()));
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });

    // 2. Leer el estado: primero localStorage (next-themes lo escribe aquí),
    //    con classList como fallback.
    setIsDark(readThemeFromStorage());
    setMounted(true);

    // 3. Re-leer en el siguiente frame, por si next-themes aplica la clase
    //    en su propio useEffect (que corre después del nuestro).
    const raf = requestAnimationFrame(() => setIsDark(readDark()));

    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  if (!mounted) {
    return (
      <div
        className={cn('h-9 w-9 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse', className)}
        aria-hidden
      />
    );
  }

  const handleToggle = () => {
    const root = document.documentElement;
    // Leer el DOM directo — no depende del estado React
    const nowDark = root.classList.contains('dark');
    const next    = nowDark ? 'light' : 'dark';

    root.classList.remove('light', 'dark');
    root.classList.add(next);

    try { localStorage.setItem(STORAGE_KEY, next); } catch (_) {}
    // El MutationObserver actualiza isDark automáticamente
  };

  return (
    <button
      onClick={handleToggle}
      aria-label={isDark ? 'Cambiar a modo día' : 'Cambiar a modo noche'}
      title={isDark ? 'Modo día' : 'Modo noche'}
      className={cn(
        'relative w-9 h-9 rounded-full flex items-center justify-center',
        'border transition-colors duration-300',
        'focus:outline-none focus:ring-2 focus:ring-offset-2',
        isDark
          ? 'bg-slate-700 border-slate-600 text-amber-300 hover:bg-slate-600 focus:ring-amber-400 focus:ring-offset-slate-900'
          : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200 focus:ring-slate-400',
        className,
      )}
    >
      {/* ☀️ visible en modo oscuro */}
      <span
        className="absolute inset-0 flex items-center justify-center transition-all duration-300"
        style={{
          opacity:   isDark ? 1 : 0,
          transform: isDark ? 'rotate(0deg) scale(1)' : 'rotate(-90deg) scale(0.5)',
          pointerEvents: 'none',
        }}
      >
        <Sun size={16} />
      </span>

      {/* 🌙 visible en modo claro */}
      <span
        className="absolute inset-0 flex items-center justify-center transition-all duration-300"
        style={{
          opacity:   isDark ? 0 : 1,
          transform: isDark ? 'rotate(90deg) scale(0.5)' : 'rotate(0deg) scale(1)',
          pointerEvents: 'none',
        }}
      >
        <Moon size={16} />
      </span>
    </button>
  );
}
