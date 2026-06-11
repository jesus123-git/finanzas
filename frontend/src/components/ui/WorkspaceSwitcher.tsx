'use client';

import { useState, useRef, useEffect } from 'react';
import { User, Building2, type LucideIcon } from 'lucide-react';
import { useWorkspace, type WorkspaceMode } from '@/context/workspace.context';
import { cn } from '@/lib/utils';

// ─── WorkspaceSwitcher ────────────────────────────────────────────────────────
//
// Dropdown elegante en el Navbar para cambiar entre módulos.
// Al cambiar de workspace redirige a /personal o /empresas y cambia el
// color de acento de toda la app (teal NOMI = personal, violeta = empresarial).

interface Option {
  value:    WorkspaceMode;
  label:    string;
  icon:     LucideIcon;
  subtitle: string;
  color:    string;        // Clase de color del ícono
  badge:    string;        // Clase del badge pill
}

const OPTIONS: Option[] = [
  {
    value:    'personal',
    label:    'Finanzas Personales',
    icon:     User,
    subtitle: 'Cuentas, transacciones y ahorro',
    color:    'text-emerald-600 dark:text-emerald-400',
    badge:    'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
  },
  {
    value:    'empresas',
    label:    'Finanzas Empresariales',
    icon:     Building2,
    subtitle: 'Facturas, clientes y reportes',
    color:    'text-violet-600 dark:text-violet-400',
    badge:    'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300',
  },
];

export function WorkspaceSwitcher() {
  const { mode, setMode } = useWorkspace();
  const [open, setOpen]   = useState(false);
  const ref               = useRef<HTMLDivElement>(null);

  const current = OPTIONS.find(o => o.value === mode)!;

  // Cerrar al hacer clic fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Cerrar con Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const handleSelect = (opt: Option) => {
    setOpen(false);
    if (opt.value !== mode) setMode(opt.value);
  };

  return (
    <div ref={ref} className="relative">
      {/* ── Trigger ── */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-xl',
          'border transition-all duration-150',
          'text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2',
          // Personal
          mode === 'personal' && 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 focus:ring-emerald-500',
          // Empresarial
          mode === 'empresas' && 'bg-violet-50 dark:bg-violet-950/50 border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/60 focus:ring-violet-500',
        )}
      >
        <current.icon size={16} aria-hidden />
        {/* En móvil ocultamos el label, en desktop se muestra */}
        <span className="hidden sm:inline truncate max-w-[140px]">{current.label}</span>
        {/* Chevron */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={cn('h-4 w-4 flex-shrink-0 transition-transform duration-150', open && 'rotate-180')}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* ── Dropdown ── */}
      {open && (
        <div
          role="listbox"
          aria-label="Seleccionar módulo"
          className={cn(
            'absolute left-0 top-full mt-2 z-50 w-72',
            'rounded-2xl border shadow-xl',
            'bg-white dark:bg-slate-800',
            'border-slate-200 dark:border-slate-700',
            'animate-fade-up',
          )}
        >
          <div className="p-2 space-y-1">
            <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 select-none">
              Módulo activo
            </p>

            {OPTIONS.map(opt => {
              const isActive = opt.value === mode;
              return (
                <button
                  key={opt.value}
                  role="option"
                  aria-selected={isActive}
                  onClick={() => handleSelect(opt)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left',
                    'transition-all duration-150 focus:outline-none',
                    isActive
                      ? cn('font-semibold', opt.badge)
                      : 'hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-300',
                  )}
                >
                  {/* Ícono con anillo de color */}
                  <span className={cn(
                    'w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0',
                    isActive ? opt.badge : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400',
                  )}>
                    <opt.icon size={17} />
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{opt.label}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{opt.subtitle}</p>
                  </div>

                  {/* Check activo */}
                  {isActive && (
                    <svg xmlns="http://www.w3.org/2000/svg" className={cn('h-4 w-4 flex-shrink-0', opt.color)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-700">
            <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center">
              Los datos de cada módulo son independientes
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
