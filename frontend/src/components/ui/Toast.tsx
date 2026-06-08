'use client';

import { useEffect, useState, useCallback } from 'react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastData {
  id:      string;
  message: string;
  type:    ToastType;
}

interface Props {
  toasts:    ToastData[];
  onDismiss: (id: string) => void;
}

const STYLES: Record<ToastType, { bar: string; bg: string; text: string; icon: string }> = {
  success: {
    bar:  'bg-emerald-500',
    bg:   'bg-white dark:bg-slate-800 border-emerald-200 dark:border-emerald-800',
    text: 'text-slate-700 dark:text-slate-200',
    icon: '✓',
  },
  error: {
    bar:  'bg-red-500',
    bg:   'bg-white dark:bg-slate-800 border-red-200 dark:border-red-800',
    text: 'text-slate-700 dark:text-slate-200',
    icon: '✕',
  },
  info: {
    bar:  'bg-blue-500',
    bg:   'bg-white dark:bg-slate-800 border-blue-200 dark:border-blue-800',
    text: 'text-slate-700 dark:text-slate-200',
    icon: 'ℹ',
  },
};

function ToastItem({ toast, onDismiss }: { toast: ToastData; onDismiss: () => void }) {
  const s = STYLES[toast.type];

  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div
      className={`
        flex items-start gap-3 w-80 rounded-xl border shadow-lg overflow-hidden
        animate-slide-in ${s.bg}
      `}
      role="alert"
    >
      <div className={`w-1 self-stretch flex-shrink-0 ${s.bar}`} />
      <div className={`mt-3.5 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${s.bar}`}>
        {s.icon}
      </div>
      <p className={`flex-1 py-3.5 pr-2 text-sm leading-snug ${s.text}`}>
        {toast.message}
      </p>
      <button
        onClick={onDismiss}
        className="mt-3 mr-3 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors flex-shrink-0 text-lg leading-none"
        aria-label="Cerrar notificación"
      >
        ×
      </button>
    </div>
  );
}

export function ToastContainer({ toasts, onDismiss }: Props) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed top-5 right-5 z-[200] flex flex-col gap-2.5" aria-live="polite">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>
  );
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, toast, dismissToast };
}
