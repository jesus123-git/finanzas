'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/auth.context';
import { useDashboard } from '@/hooks/useDashboard';
import Button from '@/components/ui/Button';
import { SummaryCards } from '@/components/dashboard/SummaryCards';
import { AccountsList } from '@/components/dashboard/AccountsList';
import { TransactionsList } from '@/components/dashboard/TransactionsList';
import { NewTransactionModal } from '@/components/transactions/NewTransactionModal';
import {
  SkeletonCard,
  SkeletonRow,
  SkeletonAccount,
} from '@/components/dashboard/SkeletonCard';

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const {
    data, loading, error, refetch,
    applyOptimistic, revertOptimistic, confirmOptimistic,
  } = useDashboard();

  const [modalOpen, setModalOpen] = useState(false);
  const [greeting, setGreeting] = useState('');

  // Saludo dinámico: calculado solo en el cliente para evitar hydration mismatch
  useEffect(() => {
    const hour = new Date().getHours();
    setGreeting(
      hour < 12 ? 'Buenos días' :
      hour < 18 ? 'Buenas tardes' :
                  'Buenas noches',
    );
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ─── Topbar ─────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center shadow-sm">
              <span className="text-sm">💸</span>
            </div>
            <span className="font-bold text-slate-800 text-lg">Finanzas</span>
          </div>

          <div className="flex items-center gap-3">
            {/* Avatar con inicial del nombre */}
            <div className="hidden sm:flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                <span className="text-sm font-bold text-emerald-600">
                  {(user?.name ?? user?.email ?? 'U')[0].toUpperCase()}
                </span>
              </div>
              <span className="text-sm text-slate-600 font-medium">
                {user?.name ?? user?.email}
              </span>
            </div>
            <Button variant="ghost" onClick={logout} className="text-sm px-3 py-2">
              Salir
            </Button>
          </div>
        </div>
      </header>

      {/* ─── Cuerpo ──────────────────────────────────────────────────────── */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* Saludo */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              {greeting ? (
                <>{greeting}, {user?.name?.split(' ')[0] ?? 'usuario'} 👋</>
              ) : (
                <span className="invisible" aria-hidden>·</span>
              )}
            </h1>
            <p className="text-slate-400 text-sm mt-0.5">
              Aquí está el resumen de tus finanzas
            </p>
          </div>
          {/* Acciones */}
          <div className="flex items-center gap-2">
            {!loading && data && (
              <Button
                onClick={() => setModalOpen(true)}
                className="gap-1.5 text-sm"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
                <span className="hidden sm:inline">Nueva transacción</span>
                <span className="sm:hidden">Nueva</span>
              </Button>
            )}
            {!loading && (
              <button
                onClick={refetch}
                className="text-slate-400 hover:text-emerald-500 transition-colors p-2 rounded-lg hover:bg-emerald-50"
                title="Actualizar datos"
                aria-label="Actualizar datos del dashboard"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* ─── Error global ─────────────────────────────────────────────── */}
        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-5 py-4 flex items-center justify-between">
            <p className="text-sm text-red-700">⚠️ {error}</p>
            <button
              onClick={refetch}
              className="text-xs font-semibold text-red-600 hover:text-red-800 underline"
            >
              Reintentar
            </button>
          </div>
        )}

        {/* ─── Tarjetas de resumen ───────────────────────────────────────── */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : data ? (
          <SummaryCards data={data} />
        ) : null}

        {/* ─── Cuentas + Transacciones (layout de dos columnas en lg) ───── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* Cuentas bancarias — columna izquierda */}
          <section className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-slate-800">Mis cuentas</h2>
              {!loading && data && (
                <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                  {data.accounts.length} cuenta{data.accounts.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {loading ? (
              <div className="space-y-1">
                <SkeletonAccount />
                <SkeletonAccount />
                <SkeletonAccount />
              </div>
            ) : data ? (
              <AccountsList accounts={data.accounts} />
            ) : null}
          </section>

          {/* Transacciones recientes — columna derecha */}
          <section className="lg:col-span-3 bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-slate-800">
                Transacciones recientes
              </h2>
              {!loading && data && (
                <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                  Últimas {data.recentTransactions.length}
                </span>
              )}
            </div>

            {loading ? (
              <div className="space-y-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <SkeletonRow key={i} />
                ))}
              </div>
            ) : data ? (
              <TransactionsList transactions={data.recentTransactions} />
            ) : null}
          </section>
        </div>

        {/* ─── Footer de sesión (debug, solo en desarrollo) ──────────────── */}
        {process.env.NODE_ENV === 'development' && (
          <details className="rounded-xl bg-white border border-slate-200 p-4 text-xs text-slate-400">
            <summary className="cursor-pointer font-medium text-slate-500 select-none">
              🔍 Debug — sesión activa
            </summary>
            <pre className="mt-3 overflow-auto p-3 bg-slate-50 rounded-lg leading-relaxed">
              {JSON.stringify({ user, dataLoaded: !!data }, null, 2)}
            </pre>
          </details>
        )}
      </main>

      {/* ─── Modal de nueva transacción ────────────────────────────────── */}
      {data && (
        <NewTransactionModal
          open={modalOpen}
          accounts={data.accounts}
          onClose={() => setModalOpen(false)}
          onOptimisticApply={applyOptimistic}
          onOptimisticRevert={revertOptimistic}
          onOptimisticConfirm={confirmOptimistic}
        />
      )}
    </div>
  );
}
