'use client';

import { useRouter } from 'next/navigation';
import { usePlan } from '@/context/PlanContext';

function Bar({ value, limit }: { value: number; limit: number | null }) {
  if (limit === null) return <span className="text-xs text-green-600 dark:text-green-400 font-medium">Ilimitado</span>;
  const pct = Math.min((value / limit) * 100, 100);
  const color = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-400' : 'bg-blue-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-500 dark:text-gray-400 w-10 text-right">{value}/{limit}</span>
    </div>
  );
}

const ROWS = [
  { label: 'Facturas este mes', valueKey: 'invoicesThisMonth' as const, limitKey: 'invoiceLimit' as const },
  { label: 'Clientes',          valueKey: 'customersCount'    as const, limitKey: 'customerLimit' as const },
  { label: 'Productos',         valueKey: 'productsCount'     as const, limitKey: 'productLimit'  as const },
  { label: 'Cotizaciones',      valueKey: 'quotesThisMonth'   as const, limitKey: 'quoteLimit'    as const },
  { label: 'Proveedores',       valueKey: 'suppliersCount'    as const, limitKey: 'supplierLimit' as const },
];

export function UsageCard() {
  const { plan, usage, isLoading } = usePlan();
  const router = useRouter();

  if (isLoading || !usage) return null;

  if (plan !== 'FREE') {
    return (
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/40 rounded-xl px-4 py-3 flex items-center justify-between">
        <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Plan {plan} activo</span>
        <span className="text-xs text-blue-500 dark:text-blue-400">✓ Sin límites</span>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Plan gratuito</span>
      </div>
      <div className="space-y-2">
        {ROWS.map(row => (
          <div key={row.valueKey} className="flex items-center gap-3">
            <span className="text-xs text-gray-600 dark:text-gray-400 w-36 flex-shrink-0">{row.label}</span>
            <Bar value={usage[row.valueKey]} limit={usage[row.limitKey]} />
          </div>
        ))}
      </div>
      <button
        onClick={() => router.push('/planes')}
        className="w-full mt-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-xs font-semibold transition"
      >
        Actualizar a Nomi PRO — $16.900/mes
      </button>
    </div>
  );
}
