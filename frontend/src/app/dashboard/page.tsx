'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/auth.context';
import { useDashboard } from '@/hooks/useDashboard';
import { useWebhookPoll } from '@/hooks/useWebhookPoll';
import Button from '@/components/ui/Button';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { ToastContainer, useToast } from '@/components/ui/Toast';
import { SummaryCards } from '@/components/dashboard/SummaryCards';
import { AccountsList } from '@/components/dashboard/AccountsList';
import { TransactionsList } from '@/components/dashboard/TransactionsList';
import { AIAdvisorCard } from '@/components/dashboard/AIAdvisorCard';
import { ComingSoonTile } from '@/components/dashboard/ComingSoonTile';
import { BankSimulatorPanel } from '@/components/dashboard/BankSimulatorPanel';
import { NewTransactionModal } from '@/components/transactions/NewTransactionModal';
import { CreateAccountModal } from '@/components/accounts/CreateAccountModal';
import {
  SkeletonCard,
  SkeletonRow,
  SkeletonAccount,
} from '@/components/dashboard/SkeletonCard';

// ─── Bento tile base ───────────────────────────────────────────────────────────
// Tarjeta blanca con borde y sombra sutil — reutilizada por cada sección.
function BentoCard({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`
        bg-white dark:bg-slate-800
        rounded-2xl
        border border-slate-100 dark:border-slate-700
        shadow-sm hover:shadow-md
        transition-shadow duration-200
        ${className}
      `}
    >
      {children}
    </div>
  );
}

// ─── Página principal ──────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const {
    data, loading, error, refetch,
    applyOptimistic, revertOptimistic, confirmOptimistic,
  } = useDashboard();

  const [modalOpen,   setModalOpen]   = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const { toasts, toast, dismissToast } = useToast();

  // Polling de webhooks: refresca automáticamente cuando llega un SMS real
  useWebhookPoll(refetch);

  // Saludo dependiente de la hora — inicializa vacío para evitar hidratación mismatch
  const [greeting, setGreeting] = useState('');
  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h >= 6 && h < 12 ? 'Buenos días' : h < 18 ? 'Buenas tardes' : 'Buenas noches');
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">

      {/* ── Header sticky ─────────────────────────────────────────────────── */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3">

          {/* Logo */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center shadow-sm">
              <span className="text-sm">💸</span>
            </div>
            <span className="font-bold text-slate-800 dark:text-white text-lg hidden sm:block">
              Finanzas
            </span>
          </div>

          {/* Acciones derechas */}
          <div className="flex items-center gap-2 flex-wrap justify-end">

            {/* Botón toggle de tema */}
            <ThemeToggle />

            {/* Acciones de datos (solo cuando hay datos cargados) */}
            {!loading && data && (
              <>
                <Button
                  variant="ghost"
                  onClick={() => setAccountOpen(true)}
                  className="gap-1.5 text-sm border border-slate-200 dark:border-slate-600"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                  <span className="hidden sm:inline">Nueva cuenta</span>
                </Button>

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
              </>
            )}

            {/* Botón refresh */}
            {!loading && (
              <button
                onClick={refetch}
                className="p-2 rounded-lg text-slate-400 dark:text-slate-500 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                title="Actualizar datos"
                aria-label="Actualizar datos del dashboard"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            )}

            {/* Avatar */}
            <div className="hidden sm:flex items-center gap-2 pl-1 border-l border-slate-200 dark:border-slate-700">
              <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center">
                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  {(user?.name ?? user?.email ?? 'U')[0].toUpperCase()}
                </span>
              </div>
              <span className="text-sm text-slate-600 dark:text-slate-300 font-medium hidden md:block">
                {user?.name ?? user?.email}
              </span>
            </div>

            <Button variant="ghost" onClick={logout} className="text-sm px-3 py-2">
              Salir
            </Button>
          </div>
        </div>
      </header>

      {/* ── Cuerpo ────────────────────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        {/* Saludo ─────────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 leading-tight">
              {greeting ? (
                <>{greeting}, {user?.name?.split(' ')[0] ?? 'usuario'} 👋</>
              ) : (
                <span className="inline-block h-8 w-56 rounded-lg bg-slate-200 dark:bg-slate-700 animate-pulse align-middle" aria-hidden />
              )}
            </h1>
            <p className="text-slate-400 dark:text-slate-500 text-sm mt-0.5">
              Aquí está el resumen de tus finanzas
            </p>
          </div>
          <Link
            href="/accounts"
            className="hidden sm:flex items-center gap-1 text-sm font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
          >
            Ver cuentas →
          </Link>
        </div>

        {/* Error global ───────────────────────────────────────────────────── */}
        {error && (
          <div className="rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 px-5 py-4 flex items-center justify-between">
            <p className="text-sm text-red-700 dark:text-red-400">⚠️ {error}</p>
            <button
              onClick={refetch}
              className="text-xs font-semibold text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 underline"
            >
              Reintentar
            </button>
          </div>
        )}

        {/* ── Bento Grid (12 columnas) ──────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

          {/* ── Fila 1: Tarjetas de resumen ─────────────────────────────── */}
          <div className="col-span-1 lg:col-span-12">
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </div>
            ) : data ? (
              <SummaryCards data={data} />
            ) : null}
          </div>

          {/* ── Fila 2: Asesor MaIA (ancho completo) ────────────────────── */}
          {data && (
            <div className="col-span-1 lg:col-span-12">
              <AIAdvisorCard data={data} userName={user?.name} />
            </div>
          )}
          {loading && (
            <div className="col-span-1 lg:col-span-12">
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-6 h-32 animate-pulse">
                <div className="flex gap-3 mb-4">
                  <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-xl" />
                  <div className="flex flex-col gap-2 flex-1">
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-48" />
                    <div className="h-3 bg-slate-100 dark:bg-slate-700/50 rounded w-36" />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-full" />
                  <div className="h-3 bg-slate-100 dark:bg-slate-700/50 rounded w-3/4" />
                </div>
              </div>
            </div>
          )}

          {/* ── Fila 3: Cuentas (5 cols) + Transacciones (7 cols) ───────── */}
          <div className="col-span-1 lg:col-span-5">
            <BentoCard className="p-6 h-full">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">Mis cuentas</h2>
                <div className="flex items-center gap-2">
                  {data && (
                    <span className="text-xs text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">
                      {data.accounts.length} cuenta{data.accounts.length !== 1 ? 's' : ''}
                    </span>
                  )}
                  <Link
                    href="/accounts"
                    className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
                  >
                    Ver todas →
                  </Link>
                </div>
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
            </BentoCard>
          </div>

          <div className="col-span-1 lg:col-span-7">
            <BentoCard className="p-6 h-full">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
                  Transacciones recientes
                </h2>
                {data && (
                  <span className="text-xs text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">
                    Últimas {data.recentTransactions.length}
                  </span>
                )}
              </div>

              {loading ? (
                <div className="space-y-1">
                  {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
                </div>
              ) : data ? (
                <TransactionsList transactions={data.recentTransactions} />
              ) : null}
            </BentoCard>
          </div>

          {/* ── Fila 4: Placeholders Calendario + Análisis ──────────────── */}
          <div className="col-span-1 lg:col-span-7">
            <ComingSoonTile
              icon="📅"
              title="Calendario de Flujo de Caja"
              description="Vista mensual interactiva con ingresos y gastos por día. Haz clic en cualquier día para ver el detalle de sus movimientos."
              step="Etapa 2"
              minHeight="min-h-[220px]"
            />
          </div>

          <div className="col-span-1 lg:col-span-5">
            <ComingSoonTile
              icon="📊"
              title="Análisis por Categorías"
              description="Gráfica de dona con tus gastos agrupados en Comida, Servicios, Transporte y Gustos."
              step="Etapa 3"
              minHeight="min-h-[220px]"
            />
          </div>

          {/* ── Fila 5: Placeholder Excel (ancho completo) ──────────────── */}
          <div className="col-span-1 lg:col-span-12">
            <ComingSoonTile
              icon="📂"
              title="Importar desde Excel"
              description="Arrastra tu archivo .xlsx con transacciones históricas y las procesamos automáticamente en 3 pasos."
              step="Etapa 4"
              minHeight="min-h-[140px]"
            />
          </div>

          {/* ── Fila 6: Simulador (solo en desarrollo) ──────────────────── */}
          {process.env.NODE_ENV === 'development' && data && (
            <div className="col-span-1 lg:col-span-12">
              <BankSimulatorPanel accounts={data.accounts} onSuccess={refetch} />
            </div>
          )}

          {/* Debug de sesión (solo en desarrollo) */}
          {process.env.NODE_ENV === 'development' && (
            <div className="col-span-1 lg:col-span-12">
              <details className="rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 text-xs text-slate-400 dark:text-slate-500">
                <summary className="cursor-pointer font-medium text-slate-500 dark:text-slate-400 select-none">
                  🔍 Debug — sesión activa
                </summary>
                <pre className="mt-3 overflow-auto p-3 bg-slate-50 dark:bg-slate-900 rounded-lg leading-relaxed">
                  {JSON.stringify({ user, dataLoaded: !!data }, null, 2)}
                </pre>
              </details>
            </div>
          )}

        </div>
      </main>

      {/* ── Modales ───────────────────────────────────────────────────────── */}
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

      <CreateAccountModal
        open={accountOpen}
        onClose={() => setAccountOpen(false)}
        onSuccess={(account) => {
          setAccountOpen(false);
          toast(`Cuenta "${account.name}" creada exitosamente 🎉`, 'success');
          refetch();
        }}
      />

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
