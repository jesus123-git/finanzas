import { formatCurrency } from '@/lib/utils';
import { AccountType, type BankAccount } from '@/types/dashboard.types';

interface Props {
  accounts: BankAccount[];
}

const ACCOUNT_CONFIG: Record<AccountType, { icon: string; label: string; light: string; dark: string }> = {
  [AccountType.CHECKING]: { icon: '🏦', label: 'Corriente',  light: 'bg-blue-50 text-blue-600',   dark: 'dark:bg-blue-900/40 dark:text-blue-400'   },
  [AccountType.SAVINGS]:  { icon: '🏛️', label: 'Ahorros',    light: 'bg-emerald-50 text-emerald-600', dark: 'dark:bg-emerald-900/40 dark:text-emerald-400' },
  [AccountType.CREDIT]:   { icon: '💳', label: 'Crédito',    light: 'bg-purple-50 text-purple-600',  dark: 'dark:bg-purple-900/40 dark:text-purple-400'  },
  [AccountType.CASH]:     { icon: '💵', label: 'Efectivo',   light: 'bg-amber-50 text-amber-600',   dark: 'dark:bg-amber-900/40 dark:text-amber-400'   },
};

export function AccountsList({ accounts }: Props) {
  if (accounts.length === 0) {
    return (
      <div className="text-center py-10 text-slate-400 dark:text-slate-600">
        <p className="text-3xl mb-2">🏦</p>
        <p className="text-sm">No tienes cuentas registradas aún.</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-slate-100 dark:divide-slate-700">
      {accounts.map((account) => {
        const cfg = ACCOUNT_CONFIG[account.type] ?? ACCOUNT_CONFIG[AccountType.CHECKING];
        const isNegative = account.balance < 0;

        return (
          <li
            key={account.id}
            className="flex items-center justify-between px-2 py-4 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-default"
          >
            <div className="flex items-center gap-3">
              <span className={`text-xl w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0 ${cfg.light} ${cfg.dark}`}>
                {cfg.icon}
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-tight">
                  {account.name}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                  {cfg.label}
                  {account.provider ? ` · ${account.provider}` : ''}
                  {account.externalAccountId ? ` · ${account.externalAccountId}` : ''}
                </p>
              </div>
            </div>

            <div className="text-right">
              <p className={`text-sm font-bold tabular-nums ${isNegative ? 'text-rose-600 dark:text-rose-400' : 'text-slate-800 dark:text-slate-100'}`}>
                {formatCurrency(account.balance, account.currency)}
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{account.currency}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
