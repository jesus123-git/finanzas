'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  maxWidth?: string;
}

export default function Modal({
  open, onClose, title, description, children, maxWidth = 'max-w-lg',
}: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      aria-modal="true"
      role="dialog"
      aria-labelledby="modal-title"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      {/* Fondo con blur */}
      <div className="absolute inset-0 bg-slate-900/60 dark:bg-slate-950/70 backdrop-blur-sm" aria-hidden />

      {/* Panel */}
      <div
        className={cn(
          'relative w-full z-10 flex flex-col',
          'max-h-[92dvh] overflow-hidden',
          // Fondo de la tarjeta modal
          'bg-white dark:bg-slate-800',
          // Bordes
          'border border-transparent dark:border-slate-700',
          // Sombra
          'shadow-2xl dark:shadow-slate-950/50',
          // Bottom sheet en móvil / modal centrado en desktop
          'rounded-t-3xl sm:rounded-2xl',
          // Animación
          'animate-fade-up',
          maxWidth,
        )}
      >
        {/* Handle de bottom sheet (solo móvil) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 bg-slate-300 dark:bg-slate-600 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-4 pb-3 border-b border-slate-100 dark:border-slate-700">
          <div>
            <h2 id="modal-title" className="text-lg font-bold text-slate-800 dark:text-slate-100">
              {title}
            </h2>
            {description && (
              <p className="text-sm text-slate-400 dark:text-slate-500 mt-0.5">{description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="p-2 -mr-1 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Contenido scrollable */}
        <div className="overflow-y-auto flex-1">
          {children}
        </div>
      </div>
    </div>
  );
}
