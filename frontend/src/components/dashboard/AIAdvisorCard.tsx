'use client';

// ─── AIAdvisorCard ─────────────────────────────────────────────────────────────
//
// Tarjeta de resumen de lenguaje natural que actúa como "asesor financiero".
// Calcula las observaciones directamente desde los datos del dashboard —
// sin llamadas a IA externas.  En el Paso 3 se reemplazará por insights
// reales de Recharts + análisis de categorías.

import { formatCurrency } from '@/lib/utils';
import { FinancialTrafficLight } from './FinancialTrafficLight';
import type { DashboardData } from '@/types/dashboard.types';

interface Props {
  data:      DashboardData;
  userName?: string | null;
}

export function AIAdvisorCard({ data, userName }: Props) {
  const { totalIncome, totalExpense } = data;
  const firstName = userName?.split(' ')[0] ?? 'usuario';
  const net        = totalIncome - totalExpense;
  const hasData    = totalIncome > 0 || totalExpense > 0;

  // ── Construir el mensaje dinámico ─────────────────────────────────────────
  const lines: string[] = [];

  if (!hasData) {
    lines.push(`¡Hola ${firstName}! Aún no tienes transacciones registradas.`);
    lines.push('Cuando lleguen tus primeros movimientos desde el celular, aquí verás un análisis automático.');
  } else if (net > 0) {
    const savingsPct = ((net / totalIncome) * 100).toFixed(0);
    lines.push(`¡Hola ${firstName}! Tu balance del período es positivo. 💪`);
    lines.push(`Ingresaste ${formatCurrency(totalIncome)} y gastaste ${formatCurrency(totalExpense)} — un ahorro del ${savingsPct} %.`);
    if (Number(savingsPct) >= 20) {
      lines.push('Excelente disciplina financiera. Considera mover parte del ahorro a tus metas.');
    } else {
      lines.push('Vas bien, pero hay margen para aumentar tu tasa de ahorro.');
    }
  } else {
    const overPct = totalIncome > 0 ? (((totalExpense - totalIncome) / totalIncome) * 100).toFixed(0) : '0';
    lines.push(`¡Hola ${firstName}! Este período tus gastos superaron tus ingresos. ⚠️`);
    lines.push(`Gastaste ${formatCurrency(totalExpense - totalIncome)} más de lo que ingresaste (${overPct} % extra).`);
    lines.push('Revisa tus movimientos y considera ajustar los gastos variables.');
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-sm flex-shrink-0">
          <span className="text-lg">🤖</span>
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">MaIA — Asesora Financiera</h3>
          <p className="text-xs text-slate-400 dark:text-slate-500">Análisis basado en tus movimientos</p>
        </div>
      </div>

      {/* Mensaje */}
      <div className="space-y-1.5 mb-5">
        {lines.map((line, i) => (
          <p
            key={i}
            className={`text-sm leading-relaxed ${
              i === 0
                ? 'font-semibold text-slate-800 dark:text-slate-100'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            {line}
          </p>
        ))}
      </div>

      {/* Semáforo financiero */}
      {hasData && (
        <div className="border-t border-slate-100 dark:border-slate-700 pt-4">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-wide">
            Semáforo del período
          </p>
          <FinancialTrafficLight totalIncome={totalIncome} totalExpense={totalExpense} />
        </div>
      )}
    </div>
  );
}
