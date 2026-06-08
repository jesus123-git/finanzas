import { formatCurrency, formatDate } from '@/lib/utils';
import { TransactionType, type Transaction } from '@/types/dashboard.types';

interface Props {
  transactions: Transaction[];
}

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

export function TransactionsList({ transactions }: Props) {
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
        const config = TYPE_CONFIG[tx.type];
        const isOptimistic = tx.id.startsWith('temp_');

        return (
          <li
            key={tx.id}
            className={`flex items-center justify-between py-3.5 px-2 rounded-xl transition-all cursor-default
              ${isOptimistic
                ? 'opacity-70 bg-emerald-50/50 dark:bg-emerald-900/20 animate-pulse'
                : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
              }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <span
                className={`w-9 h-9 flex items-center justify-center rounded-xl text-sm font-bold flex-shrink-0 ${config.bgClass}`}
                title={config.label}
              >
                {config.icon}
              </span>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate max-w-[160px] sm:max-w-xs leading-tight">
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

            <div className="flex flex-col items-end flex-shrink-0 ml-4">
              <p className={`text-sm tabular-nums ${config.amountClass}`}>
                {config.sign}&nbsp;{formatCurrency(tx.amount, tx.bankAccount.currency)}
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                {formatDate(tx.date)}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
