'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useAuth }                    from '@/context/auth.context';
import { useAccounts }                from '@/hooks/useAccounts';
import { useAccountTransactions }     from '@/hooks/useAccountTransactions';
import { useWebhookPoll }             from '@/hooks/useWebhookPoll';
import { AccountCard }                from '@/components/accounts/AccountCard';
import { AccountMovementsPanel }      from '@/components/accounts/AccountMovementsPanel';
import { CreateAccountModal }         from '@/components/accounts/CreateAccountModal';
import { BankSimulatorPanel }         from '@/components/dashboard/BankSimulatorPanel';
import { ToastContainer, useToast }   from '@/components/ui/Toast';
import { SkeletonAccount }            from '@/components/dashboard/SkeletonCard';
import { ThemeToggle }                from '@/components/ui/ThemeToggle';
import Button                         from '@/components/ui/Button';
import { UserMenu }                   from '@/components/ui/UserMenu';
import { Logo }                       from '@/components/ui/Logo';
import type { BankAccount }           from '@/types/dashboard.types';

// ─── Página ───────────────────────────────────────────────────────────────────

export default function AccountsPage() {
  const { user } = useAuth();

  // ── Datos de cuentas ──────────────────────────────────────────────────────
  const {
    accounts,
    loading: loadingAccounts,
    error:   errorAccounts,
    refetch: refetchAccounts,
  } = useAccounts();

  // ── Cuenta seleccionada para ver movimientos ──────────────────────────────
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // ── Historial de la cuenta seleccionada ──────────────────────────────────
  const {
    data:    txData,
    loading: loadingTx,
    error:   errorTx,
    refetch: refetchTx,
  } = useAccountTransactions(selectedId);

  // ── Modal + toasts ────────────────────────────────────────────────────────
  const [accountOpen, setAccountOpen] = useState(false);
  const { toasts, toast, dismissToast } = useToast();

  // ── Al refrescar cuentas, sincronizar el objeto seleccionado ─────────────
  // Garantiza que el saldo del header de AccountMovementsPanel se actualice
  // después de cada webhook / simulación.
  const selectedAccount: BankAccount | null =
    accounts.find((a) => a.id === selectedId) ?? null;

  // Cuando la lista de cuentas se carga por primera vez y hay una sola cuenta,
  // la seleccionamos automáticamente para reducir clics.
  useEffect(() => {
    if (!loadingAccounts && accounts.length === 1 && selectedId === null) {
      setSelectedId(accounts[0].id);
    }
  }, [loadingAccounts, accounts, selectedId]);

  // ── Toggle de selección ───────────────────────────────────────────────────
  const handleSelectAccount = useCallback((account: BankAccount) => {
    setSelectedId((prev) => (prev === account.id ? null : account.id));
  }, []);

  // ── Callback unificado de refresco (simulador + polling) ─────────────────
  // Lo usa tanto BankSimulatorPanel.onSuccess como useWebhookPoll.
  // Refresca cuentas (saldo actualizado) y movimientos (nueva transacción).
  const handleSimulatorSuccess = useCallback(() => {
    refetchAccounts();
    refetchTx();
  }, [refetchAccounts, refetchTx]);

  // ── Polling de webhooks desde el móvil ────────────────────────────────────
  // Detecta transacciones reales llegadas vía iOS Shortcuts / MacroDroid y
  // actualiza el panel de movimientos y el saldo de la tarjeta al instante.
  useWebhookPoll(handleSimulatorSuccess);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">

      {/* ── Header sticky ───────────────────────────────────────────────── */}
      <header className="bg-white/90 dark:bg-slate-950/90 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800/80 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">

          {/* Logo + breadcrumb */}
          <div className="flex items-center gap-3">
            <Logo size={32} href="/dashboard" />

            <div className="hidden sm:flex items-center gap-2 text-sm">
              <span className="text-slate-300">/</span>
              <span className="font-semibold text-slate-600">Mis cuentas</span>
            </div>
          </div>

          {/* Acciones */}
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button
              variant="ghost"
              onClick={() => setAccountOpen(true)}
              className="gap-1.5 text-sm border border-slate-200 dark:border-slate-600"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden sm:inline">Nueva cuenta</span>
            </Button>

            <div className="pl-3 border-l border-slate-200 dark:border-slate-700 flex items-center">
              <UserMenu />
            </div>
          </div>
        </div>
      </header>

      {/* ── Cuerpo ──────────────────────────────────────────────────────── */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* Título de sección */}
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Mis cuentas</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Selecciona una cuenta para ver su historial de movimientos
          </p>
        </div>

        {/* Error global */}
        {errorAccounts && (
          <div className="rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 px-5 py-4 flex items-center justify-between">
            <p className="text-sm text-red-700 dark:text-red-400">⚠️ {errorAccounts}</p>
            <button
              onClick={refetchAccounts}
              className="text-xs font-semibold text-red-600 hover:text-red-800 underline"
            >
              Reintentar
            </button>
          </div>
        )}

        {/* ── Grid principal: 2 cols cuentas + 3 cols movimientos ─────── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">

          {/* ── Columna izquierda: tarjetas de cuentas ──────────────── */}
          <section className="lg:col-span-2 space-y-3">

            {/* Cabecera de la sección */}
            <div className="flex items-center justify-between h-7">
              <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                {loadingAccounts
                  ? 'Cargando…'
                  : `${accounts.length} cuenta${accounts.length !== 1 ? 's' : ''}`
                }
              </p>
              {!loadingAccounts && (
                <button
                  onClick={refetchAccounts}
                  className="text-slate-400 hover:text-emerald-500 transition-colors p-1.5 rounded-lg hover:bg-emerald-50"
                  title="Actualizar cuentas"
                  aria-label="Actualizar cuentas"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              )}
            </div>

            {/* Skeletons de carga */}
            {loadingAccounts && Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl border border-slate-200 bg-white p-4 animate-pulse"
              >
                <SkeletonAccount />
              </div>
            ))}

            {/* Estado vacío */}
            {!loadingAccounts && !errorAccounts && accounts.length === 0 && (
              <div className="rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8 text-center">
                <p className="text-3xl mb-2">🏦</p>
                <p className="text-sm font-semibold text-slate-600">Sin cuentas registradas</p>
                <p className="text-xs text-slate-400 mt-1">
                  Crea tu primera cuenta con el botón &quot;Nueva cuenta&quot;
                </p>
              </div>
            )}

            {/* Tarjetas de cuentas */}
            {!loadingAccounts && accounts.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                selected={selectedId === account.id}
                onClick={handleSelectAccount}
              />
            ))}
          </section>

          {/* ── Columna derecha: panel de movimientos ─────────────────── */}
          <section className="lg:col-span-3">
            {selectedAccount ? (
              <AccountMovementsPanel
                account={selectedAccount}
                data={txData}
                loading={loadingTx}
                error={errorTx}
                onClose={() => setSelectedId(null)}
                onRetry={refetchTx}
              />
            ) : (
              /* Estado vacío — ninguna cuenta seleccionada */
              <div className="rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-col items-center justify-center text-center p-12 min-h-[340px]">
                {loadingAccounts ? (
                  <>
                    <div className="w-12 h-12 rounded-full bg-slate-100 animate-pulse mb-4" />
                    <div className="h-4 bg-slate-100 rounded w-36 animate-pulse" />
                  </>
                ) : (
                  <>
                    <span className="text-5xl mb-4 select-none" aria-hidden>👈</span>
                    <p className="text-base font-semibold text-slate-600 dark:text-slate-300">
                      Selecciona una cuenta
                    </p>
                    <p className="text-sm text-slate-400 dark:text-slate-500 mt-1.5 max-w-xs leading-relaxed">
                      Haz clic en cualquier tarjeta para ver su historial de movimientos detallado
                    </p>
                  </>
                )}
              </div>
            )}
          </section>
        </div>

        {/* ── Simulador Open Banking (solo en desarrollo) ─────────────── */}
        {process.env.NODE_ENV === 'development' && !loadingAccounts && (
          <BankSimulatorPanel
            accounts={accounts}
            onSuccess={handleSimulatorSuccess}
          />
        )}

        {/* ── Footer de navegación ───────────────────────────────────── */}
        <div className="flex justify-center pt-2 pb-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-emerald-600 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Volver al dashboard
          </Link>
        </div>
      </main>

      {/* ── Modales ──────────────────────────────────────────────────────── */}
      <CreateAccountModal
        open={accountOpen}
        onClose={() => setAccountOpen(false)}
        onSuccess={(account) => {
          setAccountOpen(false);
          toast(`Cuenta "${account.name}" creada exitosamente 🎉`, 'success');
          refetchAccounts().then(() => {
            // Selecciona automáticamente la cuenta recién creada
            setSelectedId(account.id);
          });
        }}
      />

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
