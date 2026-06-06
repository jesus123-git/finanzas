import { formatCurrency } from '@/lib/utils';
import type { DashboardData } from '@/types/dashboard.types';

interface Props {
  data: DashboardData;
}

export function SummaryCards({ data }: Props) {
  const netBalance = data.summary.totalByCurrency['COP'] ?? 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">

      {/* Saldo total — tarjeta destacada */}
      <div className="sm:col-span-1 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-6 shadow-md text-white">
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

// ─── Tarjeta de métrica secundaria ────────────────────────────────────────────

function MetricCard({
  label, value, icon, trend, subtitle,
}: {
  label: string;
  value: number;
  icon: string;
  trend: 'up' | 'down';
  subtitle: string;
}) {
  const trendStyles = {
    up:   { bg: 'bg-blue-50',  icon: 'bg-blue-100 text-blue-600',  text: 'text-blue-700' },
    down: { bg: 'bg-rose-50',  icon: 'bg-rose-100 text-rose-600',  text: 'text-rose-700' },
  };
  const s = trendStyles[trend];

  return (
    <div className={`${s.bg} rounded-2xl border border-transparent p-6 shadow-sm`}>
      <div className="flex items-center justify-between mb-4">
        <p className="text-slate-500 text-sm font-medium">{label}</p>
        <span className={`text-xl p-2 rounded-xl ${s.icon}`}>{icon}</span>
      </div>
      <p className={`text-2xl font-bold ${s.text}`}>
        {formatCurrency(value)}
      </p>
      <p className="text-slate-400 text-xs mt-1">{subtitle}</p>
    </div>
  );
}
