'use client';

import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import { useNewTransaction } from '@/hooks/useNewTransaction';
import { TransactionType } from '@/types/api.enums';
import { formatCurrency } from '@/lib/utils';
import type { BankAccount } from '@/types/dashboard.types';
import type { OptimisticTransaction } from '@/hooks/useDashboard';
import type { Transaction } from '@/types/dashboard.types';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  accounts: BankAccount[];
  onClose: () => void;
  onOptimisticApply:   (opt: OptimisticTransaction) => void;
  onOptimisticRevert:  (opt: OptimisticTransaction) => void;
  onOptimisticConfirm: (tempId: string, realTx: Transaction) => void;
}

// ─── Configuración de tabs de tipo de transacción ─────────────────────────────

const TYPE_TABS: { value: TransactionType; label: string; icon: string; color: string }[] = [
  { value: TransactionType.EXPENSE,  label: 'Gasto',         icon: '↓', color: 'rose'    },
  { value: TransactionType.INCOME,   label: 'Ingreso',       icon: '↑', color: 'emerald' },
  { value: TransactionType.TRANSFER, label: 'Transferencia', icon: '⇄', color: 'blue'    },
];

const TAB_ACTIVE: Record<string, string> = {
  rose:    'bg-rose-500    text-white shadow-sm',
  emerald: 'bg-emerald-500 text-white shadow-sm',
  blue:    'bg-blue-500    text-white shadow-sm',
};

const TAB_INACTIVE = 'bg-transparent text-slate-500 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-700';

// ─── Componente ───────────────────────────────────────────────────────────────

export function NewTransactionModal({
  open, accounts, onClose,
  onOptimisticApply, onOptimisticRevert, onOptimisticConfirm,
}: Props) {

  const {
    form, errors, apiError, submitting, loadingMeta,
    categories, setField, submit,
  } = useNewTransaction({
    accounts,
    onOptimisticApply,
    onOptimisticRevert,
    onOptimisticConfirm,
    onSuccess: onClose,
  });

  const accountOptions = accounts.map((a) => ({
    value: a.id,
    label: `${a.name} — ${formatCurrency(a.balance, a.currency)}`,
  }));

  const categoryOptions = categories.map((c) => ({
    value: c.id,
    label: c.name,
  }));

  const selectedType   = TYPE_TABS.find((t) => t.value === form.type)!;
  const amountNumeric  = parseFloat(form.amount) || 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nueva transacción"
      description="El cambio en el saldo se aplicará de inmediato"
    >
      <div className="px-6 py-5 space-y-5">

        {/* ── Selector de tipo (tabs) ─────────────────────────────────── */}
        <div>
          <p className="text-sm font-medium text-slate-700 mb-2">Tipo</p>
          <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
            {TYPE_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setField('type', tab.value)}
                className={`
                  flex-1 flex items-center justify-center gap-1.5
                  py-2 px-3 rounded-lg text-sm font-semibold transition-all duration-150
                  ${form.type === tab.value
                    ? TAB_ACTIVE[tab.color]
                    : TAB_INACTIVE
                  }
                `}
              >
                <span className="font-bold">{tab.icon}</span>
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Monto con vista previa formateada ──────────────────────── */}
        <div>
          <Input
            label="Monto"
            type="number"
            min="0"
            step="100"
            placeholder="0"
            value={form.amount}
            onChange={(e) => setField('amount', e.target.value)}
            error={errors.amount}
          />
          {amountNumeric > 0 && (
            <p className={`
              text-xs mt-1.5 font-semibold tabular-nums
              ${selectedType.color === 'rose'    ? 'text-rose-500'    : ''}
              ${selectedType.color === 'emerald' ? 'text-emerald-600' : ''}
              ${selectedType.color === 'blue'    ? 'text-blue-500'    : ''}
            `}>
              {selectedType.icon} {formatCurrency(amountNumeric)}
            </p>
          )}
        </div>

        {/* ── Descripción ────────────────────────────────────────────── */}
        <Input
          label="Descripción"
          type="text"
          placeholder="Ej: Mercado, nómina, pago arriendo…"
          value={form.description}
          onChange={(e) => setField('description', e.target.value)}
          error={errors.description}
          maxLength={200}
        />

        {/* ── Cuenta origen ──────────────────────────────────────────── */}
        {loadingMeta ? (
          <div className="h-[68px] bg-slate-100 animate-pulse rounded-lg" />
        ) : (
          <Select
            label={form.type === TransactionType.TRANSFER ? 'Cuenta origen' : 'Cuenta'}
            options={accountOptions}
            placeholder="— Selecciona una cuenta —"
            value={form.bankAccountId}
            onChange={(e) => setField('bankAccountId', e.target.value)}
            error={errors.bankAccountId}
          />
        )}

        {/* ── Cuenta destino (solo TRANSFER) ─────────────────────────── */}
        {form.type === TransactionType.TRANSFER && (
          loadingMeta ? (
            <div className="h-[68px] bg-slate-100 animate-pulse rounded-lg" />
          ) : (
            <Select
              label="Cuenta destino"
              options={accountOptions.filter((o) => o.value !== form.bankAccountId)}
              placeholder="— Selecciona cuenta destino —"
              value={form.destinationBankAccountId}
              onChange={(e) => setField('destinationBankAccountId', e.target.value)}
              error={errors.destinationBankAccountId}
            />
          )
        )}

        {/* ── Categoría ──────────────────────────────────────────────── */}
        {loadingMeta ? (
          <div className="h-[68px] bg-slate-100 animate-pulse rounded-lg" />
        ) : (
          <Select
            label="Categoría"
            options={categoryOptions}
            placeholder="— Selecciona una categoría —"
            value={form.categoryId}
            onChange={(e) => setField('categoryId', e.target.value)}
            error={errors.categoryId}
          />
        )}

        {/* ── Fecha ──────────────────────────────────────────────────── */}
        <Input
          label="Fecha"
          type="date"
          value={form.date}
          onChange={(e) => setField('date', e.target.value)}
          max={new Date().toISOString().split('T')[0]}
        />

        {/* ── Vista previa del efecto en el balance ───────────────────── */}
        {form.bankAccountId && amountNumeric > 0 && (() => {
          const account = accounts.find((a) => a.id === form.bankAccountId);
          if (!account) return null;
          const delta =
            form.type === TransactionType.INCOME   ?  amountNumeric :
            form.type === TransactionType.EXPENSE  ? -amountNumeric :
            -amountNumeric; // TRANSFER (origen pierde)
          const newBalance = account.balance + delta;
          return (
            <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-sm">
              <p className="text-slate-500 text-xs font-medium mb-1.5">Vista previa del balance</p>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">{account.name}</span>
                <div className="flex items-center gap-2 tabular-nums">
                  <span className="text-slate-400 line-through text-xs">
                    {formatCurrency(account.balance)}
                  </span>
                  <span className="text-slate-300">→</span>
                  <span className={`font-bold ${newBalance < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {formatCurrency(newBalance)}
                  </span>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ── Error de API ───────────────────────────────────────────── */}
        {apiError && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            ⚠️ {apiError}
          </div>
        )}
      </div>

      {/* ── Footer sticky con botones ──────────────────────────────────── */}
      <div className="sticky bottom-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-6 py-4 flex gap-3">
        <Button variant="ghost" onClick={onClose} fullWidth className="border border-slate-200 dark:border-slate-700">
          Cancelar
        </Button>
        <Button
          onClick={submit}
          loading={submitting}
          fullWidth
          className={`
            ${selectedType.color === 'rose'    ? 'bg-rose-500    hover:bg-rose-600    focus:ring-rose-500'    : ''}
            ${selectedType.color === 'emerald' ? 'bg-emerald-500 hover:bg-emerald-600 focus:ring-emerald-500' : ''}
            ${selectedType.color === 'blue'    ? 'bg-blue-500    hover:bg-blue-600    focus:ring-blue-500'    : ''}
            text-white
          `}
        >
          {submitting ? 'Guardando…' : `Registrar ${selectedType.label.toLowerCase()}`}
        </Button>
      </div>
    </Modal>
  );
}
