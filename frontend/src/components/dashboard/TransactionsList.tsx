'use client';

import { useState } from 'react';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import { TransactionType, type Transaction } from '@/types/dashboard.types';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Props {
  transactions: Transaction[];
  /** Si se pasa, aparece el botón de eliminar en cada fila */
  onDelete?: (txId: string) => Promise<void>;
}

// ─── Config visual ────────────────────────────────────────────────────────────

const TYPE_CONFIG = {
  [TransactionType.INCOME]: {
    sign:        '+',
    amountClass: 'text-emerald-600 dark:text-emerald-400 font-semibold',
    bgClass:     'bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400',
    icon:        '↑',
    label:       'Ingreso',
  },
  [TransactionType.EXPENSE]: {
    sign:        '−',
    amountClass: 'text-rose-600 dark:text-rose-400 font-semibold',
    bgClass:     'bg-rose-50 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400',
    icon:        '↓',
    label:       'Gasto',
  },
  [TransactionType.TRANSFER]: {
    sign:        '⇄',
    amountClass: 'text-slate-700 dark:text-slate-300 font-semibold',
    bgClass:     'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400',
    icon:        '⇄',
    label:       'Transferencia',
  },
};

// ─── Componente ───────────────────────────────────────────────────────────────

export function TransactionsList({ transactions, onDelete }: Props) {
  // Rastrea qué fila está en modo "confirmar eliminación" y cuál está borrando
  const [confirmId,  setConfirmId]  = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!onDelete) return;
    setDeletingId(id);
    try {
      await onDelete(id);
    } finally {
      setDeletingId(null);
      setConfirmId(null);
    }
  };

  if (transactions.length === 0) {
    return (
      <div className="text-center py-10 text-slate-400 dark:text-slate-600">
        <p className="text-3xl mb-2">📋</p>
        <p className="text-sm">Aún no hay transacciones registradas.</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-slate-100 dark:divide-slate-700">
      {transactions.map((tx) => {
        const config       = TYPE_CONFIG[tx.type];
        const isOptimistic = tx.id.startsWith('temp_');
        const isConfirm    = confirmId === tx.id;
        const isDeleting   = deletingId === tx.id;

        return (
          <li
            key={tx.id}
            className={cn(
              'flex items-center justify-between py-3.5 px-2 rounded-xl transition-all',
              isOptimistic
                ? 'opacity-70 bg-emerald-50/50 dark:bg-emerald-900/20 animate-pulse cursor-default'
                : 'group hover:bg-slate-50 dark:hover:bg-slate-700/50',
              isConfirm && 'bg-rose-50/60 dark:bg-rose-950/20',
              isDeleting && 'opacity-50 pointer-events-none',
            )}
          >
            {/* Icono + texto */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <span
                className={cn('w-9 h-9 flex items-center justify-center rounded-xl text-sm font-bold flex-shrink-0', config.bgClass)}
                title={config.label}
              >
                {config.icon}
              </span>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate max-w-[150px] sm:max-w-xs leading-tight">
                    {tx.description}
                  </p>
                  {isOptimistic && (
                    <span className="text-[10px] bg-slate-200 dark:bg-slate-600 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded-full whitespace-nowrap leading-none">
                      Guardando…
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded-md leading-none">
                    {tx.category.name}
                  </span>
                  <span className="text-slate-300 dark:text-slate-600 text-xs">·</span>
                  <span className="text-xs text-slate-400 dark:text-slate-500 truncate max-w-[100px]">
                    {tx.bankAccount.name}
                  </span>
                </div>
              </div>
            </div>

            {/* Monto + fecha + botón eliminar */}
            <div className="flex items-center gap-3 flex-shrink-0 ml-3">
              <div className="flex flex-col items-end">
                <p className={cn('text-sm tabular-nums', config.amountClass)}>
                  {config.sign}&nbsp;{formatCurrency(tx.amount, tx.bankAccount.currency)}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                  {formatDate(tx.date)}
                </p>
              </div>

              {/* Botón eliminar — solo si hay handler y la fila no es optimista */}
              {onDelete && !isOptimistic && (
                isConfirm ? (
                  /* Estado de confirmación */
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleDelete(tx.id)}
                      disabled={isDeleting}
                      className="text-[11px] font-bold text-white bg-rose-500 hover:bg-rose-600 px-2 py-1 rounded-lg transition-colors"
                      aria-label="Confirmar eliminación"
                    >
                      {isDeleting ? '…' : 'Sí'}
                    </button>
                    <button
                      onClick={() => setConfirmId(null)}
                      className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                      aria-label="Cancelar eliminación"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  /* Botón de papelera — visible en hover */
                  <button
                    onClick={() => setConfirmId(tx.id)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-300 dark:text-slate-600 hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all"
                    aria-label={`Eliminar transacción ${tx.description}`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
