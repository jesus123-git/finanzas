import { formatCurrency, formatDate } from '@/lib/utils';
import { TransactionType, type Transaction } from '@/types/dashboard.types';

interface Props {
  transactions: Transaction[];
}

// Configuración visual por tipo de transacción
const TYPE_CONFIG = {
  [TransactionType.INCOME]: {
    sign:       '+',
    amountClass: 'text-emerald-600 font-semibold',
    bgClass:     'bg-emerald-50 text-emerald-600',
    icon:        '↑',
    label:       'Ingreso',
  },
  [TransactionType.EXPENSE]: {
    sign:       '−',
    amountClass: 'text-rose-600 font-semibold',
    bgClass:     'bg-rose-50 text-rose-600',
    icon:        '↓',
    label:       'Gasto',
  },
  [TransactionType.TRANSFER]: {
    sign:       '⇄',
    amountClass: 'text-slate-700 font-semibold',
    bgClass:     'bg-slate-100 text-slate-500',
    icon:        '⇄',
    label:       'Transferencia',
  },
};

export function TransactionsList({ transactions }: Props) {
  if (transactions.length === 0) {
    return (
      <div className="text-center py-10 text-slate-400">
        <p className="text-3xl mb-2">📋</p>
        <p className="text-sm">Aún no hay transacciones registradas.</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-slate-100">
      {transactions.map((tx) => {
        const config = TYPE_CONFIG[tx.type];

        return (
          <li
            key={tx.id}
            className="flex items-center justify-between py-3.5 px-2 rounded-xl hover:bg-slate-50 transition-colors cursor-default"
          >
            {/* Icono + descripción + metadatos */}
            <div className="flex items-center gap-3 min-w-0">
              <span
                className={`w-9 h-9 flex items-center justify-center rounded-xl text-sm font-bold flex-shrink-0 ${config.bgClass}`}
                title={config.label}
              >
                {config.icon}
              </span>

              <div className="min-w-0">
                {/* Descripción — truncada si es muy larga */}
                <p className="text-sm font-medium text-slate-800 truncate max-w-[180px] sm:max-w-xs leading-tight">
                  {tx.description}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  {/* Categoría */}
                  <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md leading-none">
                    {tx.category.name}
                  </span>
                  {/* Separador */}
                  <span className="text-slate-300 text-xs">·</span>
                  {/* Cuenta */}
                  <span className="text-xs text-slate-400 truncate max-w-[100px]">
                    {tx.bankAccount.name}
                  </span>
                </div>
              </div>
            </div>

            {/* Monto + fecha */}
            <div className="flex flex-col items-end flex-shrink-0 ml-4">
              <p className={`text-sm tabular-nums ${config.amountClass}`}>
                {config.sign}&nbsp;{formatCurrency(tx.amount, tx.bankAccount.currency)}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                {formatDate(tx.date)}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
