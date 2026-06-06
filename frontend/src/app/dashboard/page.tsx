'use client';

import { useAuth } from '@/context/auth.context';
import Button from '@/components/ui/Button';

// Vista temporal del dashboard — se expandirá en la siguiente etapa.
// Aquí demostramos que el usuario autenticado está accesible vía useAuth().

export default function DashboardPage() {
  const { user, logout } = useAuth();

  return (
    <main className="min-h-screen bg-slate-50">

      {/* Topbar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
              <span className="text-sm">💸</span>
            </div>
            <span className="font-bold text-slate-800">Finanzas</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-500 hidden sm:block">
              Hola, <span className="font-medium text-slate-800">{user?.name ?? user?.email}</span>
            </span>
            <Button variant="ghost" onClick={logout} className="text-sm">
              Cerrar sesión
            </Button>
          </div>
        </div>
      </header>

      {/* Contenido */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">

        {/* Saludo */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-800">
            Buenos días, {user?.name?.split(' ')[0] ?? 'usuario'} 👋
          </h1>
          <p className="text-slate-500 mt-1">
            Aquí está el resumen de tus finanzas
          </p>
        </div>

        {/* Tarjetas de resumen (placeholders para la siguiente etapa) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-10">
          <SummaryCard
            label="Balance total"
            value="$0"
            icon="💰"
            color="emerald"
            description="En todas tus cuentas"
          />
          <SummaryCard
            label="Ingresos del mes"
            icon="📈"
            value="$0"
            color="blue"
            description="Mes actual"
          />
          <SummaryCard
            label="Gastos del mes"
            icon="📉"
            value="$0"
            color="red"
            description="Mes actual"
          />
        </div>

        {/* Placeholder de próximas funciones */}
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-3xl mb-3">🚧</p>
          <h2 className="text-lg font-semibold text-slate-700">Dashboard en construcción</h2>
          <p className="text-slate-400 text-sm mt-2 max-w-sm mx-auto">
            Aquí irán tus transacciones recientes, gráficos de gastos por categoría
            y el estado de tus metas de ahorro.
          </p>
        </div>

        {/* Info del usuario autenticado — util para debugging */}
        <details className="mt-6 rounded-xl bg-white border border-slate-200 p-4 text-xs text-slate-500">
          <summary className="cursor-pointer font-medium text-slate-600">
            🔍 Sesión activa (debug)
          </summary>
          <pre className="mt-3 overflow-auto p-3 bg-slate-50 rounded-lg">
            {JSON.stringify(user, null, 2)}
          </pre>
        </details>
      </div>
    </main>
  );
}

// ─── Componente auxiliar ──────────────────────────────────────────────────────

function SummaryCard({
  label, value, icon, color, description,
}: {
  label: string;
  value: string;
  icon: string;
  color: 'emerald' | 'blue' | 'red';
  description: string;
}) {
  const colorMap = {
    emerald: 'bg-emerald-50 text-emerald-600',
    blue:    'bg-blue-50 text-blue-600',
    red:     'bg-red-50 text-red-600',
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium text-slate-500">{label}</span>
        <span className={`text-xl p-2 rounded-xl ${colorMap[color]}`}>{icon}</span>
      </div>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
      <p className="text-xs text-slate-400 mt-1">{description}</p>
    </div>
  );
}
