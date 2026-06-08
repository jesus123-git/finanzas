// ─── FinancialTrafficLight ─────────────────────────────────────────────────────
//
// Barra de semáforo financiero que resume el estado del presupuesto del mes:
//
//   🟢 Verde  → Ahorro ≥ 20 % de los ingresos  (excelente)
//   🟡 Amarillo → Positivo pero ahorro < 20 %   (cuidado)
//   🔴 Rojo   → Gastos superan los ingresos     (alerta)
//
// La barra de progreso muestra qué porcentaje de los ingresos se ha gastado.
// El tope visual es el 120 % para que haya espacio visible incluso en rojo.

interface Props {
  totalIncome:  number;
  totalExpense: number;
}

export function FinancialTrafficLight({ totalIncome, totalExpense }: Props) {
  // Si no hay ingresos, no podemos calcular el semáforo
  if (totalIncome === 0) return null;

  const spentPct    = Math.min((totalExpense / totalIncome) * 100, 120);
  const savingsPct  = Math.max(((totalIncome - totalExpense) / totalIncome) * 100, -20);

  const isGreen  = savingsPct >= 20;
  const isRed    = totalExpense >= totalIncome;
  // isYellow = ni verde ni rojo

  const status = isGreen ? 'green' : isRed ? 'red' : 'yellow';

  const CONFIG = {
    green: {
      label:   '🟢 Muy bien',
      sub:     `Ahorras el ${savingsPct.toFixed(0)} % de tus ingresos`,
      bar:     'bg-emerald-500 dark:bg-emerald-400',
      track:   'bg-emerald-100 dark:bg-emerald-900/40',
      badge:   'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300',
    },
    yellow: {
      label:   '🟡 Con cuidado',
      sub:     `Te queda el ${savingsPct.toFixed(0)} % de tus ingresos`,
      bar:     'bg-amber-400 dark:bg-amber-300',
      track:   'bg-amber-100 dark:bg-amber-900/40',
      badge:   'bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300',
    },
    red: {
      label:   '🔴 Gastos altos',
      sub:     `Gastaste ${(spentPct - 100).toFixed(0)} % más de lo que ingresaste`,
      bar:     'bg-rose-500 dark:bg-rose-400',
      track:   'bg-rose-100 dark:bg-rose-900/40',
      badge:   'bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300',
    },
  };

  const cfg = CONFIG[status];
  // Porcentaje a mostrar en la barra: max 100 % visualmente
  const barWidth = Math.min(spentPct, 100);

  return (
    <div className="flex flex-col gap-2">
      {/* Etiqueta + badge */}
      <div className="flex items-center justify-between">
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${cfg.badge}`}>
          {cfg.label}
        </span>
        <span className="text-xs text-slate-400 dark:text-slate-500">{cfg.sub}</span>
      </div>

      {/* Barra de progreso */}
      <div className={`w-full h-3 rounded-full overflow-hidden ${cfg.track}`}>
        <div
          className={`h-full rounded-full transition-all duration-700 ${cfg.bar}`}
          style={{ width: `${barWidth}%` }}
          role="progressbar"
          aria-valuenow={Math.round(spentPct)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${Math.round(spentPct)} % del ingreso gastado`}
        />
      </div>

      {/* Leyenda */}
      <div className="flex justify-between text-[11px] text-slate-400 dark:text-slate-600 select-none">
        <span>0 %</span>
        <span>50 %</span>
        <span>100 %</span>
      </div>
    </div>
  );
}
