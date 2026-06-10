'use client';

import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  className?: string;
}

/**
 * ThemeToggle — botón para alternar entre modo claro y oscuro.
 *
 * El cambio de tema se hace SIEMPRE a través de next-themes (useTheme),
 * que es quien controla la clase `dark` en <html>. Manipular el DOM
 * directamente entra en conflicto con next-themes: en el siguiente
 * re-render reaplica su estado interno y revierte el cambio.
 *
 * Los íconos se controlan con clases `dark:` de Tailwind para evitar
 * hydration-mismatch (el servidor no conoce el tema del cliente).
 */
export function ThemeToggle({ className }: Props) {
  const { resolvedTheme, setTheme } = useTheme();

  const handleToggle = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  };

  return (
    <button
      onClick={handleToggle}
      aria-label="Cambiar tema"
      title="Cambiar tema"
      className={cn(
        // Tamaño y forma
        'relative w-9 h-9 rounded-full flex items-center justify-center',
        // Borde y transición
        'border transition-colors duration-300',
        // Focus
        'focus:outline-none focus:ring-2 focus:ring-offset-2',
        // Colores — modo claro
        'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200',
        'focus:ring-slate-400',
        // Colores — modo oscuro (dark: clases CSS, igual que todo el resto de la UI)
        'dark:bg-slate-700 dark:border-slate-600 dark:text-amber-300 dark:hover:bg-slate-600',
        'dark:focus:ring-amber-400 dark:focus:ring-offset-slate-900',
        className,
      )}
    >
      {/* ☀️ sol — oculto en claro, visible en oscuro */}
      <span
        className={cn(
          'absolute inset-0 flex items-center justify-center',
          'transition-all duration-300',
          // En modo claro: invisible y rotado
          'opacity-0 -rotate-90 scale-50',
          // En modo oscuro: visible y normal
          'dark:opacity-100 dark:rotate-0 dark:scale-100',
        )}
        aria-hidden
      >
        <Sun size={16} />
      </span>

      {/* 🌙 luna — visible en claro, oculta en oscuro */}
      <span
        className={cn(
          'absolute inset-0 flex items-center justify-center',
          'transition-all duration-300',
          // En modo claro: visible y normal
          'opacity-100 rotate-0 scale-100',
          // En modo oscuro: invisible y rotado
          'dark:opacity-0 dark:rotate-90 dark:scale-50',
        )}
        aria-hidden
      >
        <Moon size={16} />
      </span>
    </button>
  );
}
