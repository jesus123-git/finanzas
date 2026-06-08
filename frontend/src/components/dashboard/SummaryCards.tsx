import { formatCurrency } from '@/lib/utils';
import type { DashboardData } from '@/types/dashboard.types';

interface Props {
  data: DashboardData;
}

export function SummaryCards({ data }: Props) {
  const netBalance = data.summary.totalByCurrency['COP'] ?? 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

      {/* Saldo total — tarjeta destacada con gradiente */}
      <div className="sm:col-span-1 bg-gradient-to-br from-emerald-500 to-emerald-700 dark:from-emerald-700 dark:to-emerald-900 rounded-2xl p-6 shadow-md text-white">
        <div className="flex items-center justify-between mb-4">
          <p className="text-emerald-100 text-sm font-medium">Saldo neto total</p>
          <span className="text-2xl bg-white/20 p-2 rounded-xl">💰</span>
        </div>
        <p className="text-3xl font-bold tracking-tight">
          {formatCurrency(netBalance)}
        </p>
        <p className="text-emerald-200 text-xs mt-1">
          {data.summary.accountCount} cuenta{data.summary.accountCount !== 1 ? 's' : ''} activa{data.summary.accountCount !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Ingresos del período */}
      <MetricCard
        label="Ingresos del período"
        value={data.totalIncome}
        icon="📈"
        trend="up"
        subtitle="Últimas 10 transacciones"
      />

      {/* Gastos del período */}
      <MetricCard
        label="Gastos del período"
        value={data.totalExpense}
        icon="📉"
        trend="down"
        subtitle="Últimas 10 transacciones"
      />
    </div>
  );
}

function MetricCard({
  label, value, icon, trend, subtitle,
}: {
  label: string;
  value: number;
  icon: string;
  trend: 'up' | 'down';
  subtitle: string;
}) {
  const styles = {
    up: {
      wrap:   'bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/50',
      icon:   'bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400',
      amount: 'text-blue-700 dark:text-blue-300',
      label:  'text-slate-500 dark:text-slate-400',
      sub:    'text-slate-400 dark:text-slate-500',
    },
    down: {
      wrap:   'bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900/50',
      icon:   'bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-400',
      amount: 'text-rose-700 dark:text-rose-300',
      label:  'text-slate-500 dark:text-slate-400',
      sub:    'text-slate-400 dark:text-slate-500',
    },
  };
  const s = styles[trend];

  return (
    <div className={`${s.wrap} rounded-2xl p-6 shadow-sm`}>
      <div className="flex items-center justify-between mb-4">
        <p className={`${s.label} text-sm font-medium`}>{label}</p>
        <span className={`text-xl p-2 rounded-xl ${s.icon}`}>{icon}</span>
      </div>
      <p className={`text-2xl font-bold ${s.amount}`}>
        {formatCurrency(value)}
      </p>
      <p className={`${s.sub} text-xs mt-1`}>{subtitle}</p>
    </div>
  );
}
