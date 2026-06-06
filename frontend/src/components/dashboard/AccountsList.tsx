import { formatCurrency } from '@/lib/utils';
import { AccountType, type BankAccount } from '@/types/dashboard.types';

interface Props {
  accounts: BankAccount[];
}

// Iconos y colores por tipo de cuenta
const ACCOUNT_CONFIG: Record<AccountType, { icon: string; label: string; color: string }> = {
  [AccountType.CHECKING]: { icon: '🏦', label: 'Corriente',  color: 'bg-blue-50   text-blue-600'   },
  [AccountType.SAVINGS]:  { icon: '🏛️', label: 'Ahorros',    color: 'bg-emerald-50 text-emerald-600' },
  [AccountType.CREDIT]:   { icon: '💳', label: 'Crédito',    color: 'bg-purple-50  text-purple-600'  },
  [AccountType.CASH]:     { icon: '💵', label: 'Efectivo',   color: 'bg-amber-50   text-amber-600'   },
};

export function AccountsList({ accounts }: Props) {
  if (accounts.length === 0) {
    return (
      <div className="text-center py-10 text-slate-400">
        <p className="text-3xl mb-2">🏦</p>
        <p className="text-sm">No tienes cuentas registradas aún.</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-slate-100">
      {accounts.map((account) => {
        const config = ACCOUNT_CONFIG[account.type] ?? ACCOUNT_CONFIG[AccountType.CHECKING];
        const isNegative = account.balance < 0;

        return (
          <li
            key={account.id}
            className="flex items-center justify-between px-2 py-4 rounded-xl hover:bg-slate-50 transition-colors cursor-default"
          >
            <div className="flex items-center gap-3">
              {/* Icono de tipo de cuenta */}
              <span className={`text-xl w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0 ${config.color}`}>
                {config.icon}
              </span>

              <div>
                <p className="text-sm font-semibold text-slate-800 leading-tight">
                  {account.name}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {config.label}
                  {account.provider ? ` · ${account.provider}` : ''}
                  {account.externalAccountId ? ` · ${account.externalAccountId}` : ''}
                </p>
              </div>
            </div>

            {/* Saldo */}
            <div className="text-right">
              <p className={`text-sm font-bold tabular-nums ${isNegative ? 'text-rose-600' : 'text-slate-800'}`}>
                {formatCurrency(account.balance, account.currency)}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">{account.currency}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
