'use client';

import { useState, useCallback } from 'react';
import Modal   from '@/components/ui/Modal';
import Input   from '@/components/ui/Input';
import Select  from '@/components/ui/Select';
import Button  from '@/components/ui/Button';
import { apiPost }    from '@/lib/api';
import { AccountType } from '@/types/api.enums';
import type { BankAccount } from '@/types/dashboard.types';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Provider = 'NONE' | 'NEQUI' | 'BANCOLOMBIA';

interface FormState {
  name:              string;
  type:              AccountType | '';
  balance:           string;
  currency:          string;
  provider:          Provider;
  externalAccountId: string;
}

interface FormErrors {
  name?:              string;
  type?:              string;
  balance?:           string;
  externalAccountId?: string;
}

interface Props {
  open:      boolean;
  onClose:   () => void;
  onSuccess: (account: BankAccount) => void;
}

// ─── Opciones de selects ──────────────────────────────────────────────────────

const TYPE_OPTIONS = [
  { value: AccountType.SAVINGS,  label: '🏛️  Ahorros'   },
  { value: AccountType.CHECKING, label: '🏦  Corriente' },
  { value: AccountType.CREDIT,   label: '💳  Crédito'   },
  { value: AccountType.CASH,     label: '💵  Efectivo'  },
];

const PROVIDER_OPTIONS = [
  { value: 'NONE',        label: '🌐  Genérico (ninguno)'  },
  { value: 'NEQUI',       label: '📱  Nequi'               },
  { value: 'BANCOLOMBIA', label: '🏦  Bancolombia'          },
];

const CURRENCY_OPTIONS = [
  { value: 'COP', label: 'COP — Peso colombiano' },
  { value: 'USD', label: 'USD — Dólar'           },
  { value: 'EUR', label: 'EUR — Euro'            },
];

// ─── Config dinámica por proveedor ────────────────────────────────────────────

const PROVIDER_ID_CONFIG: Record<Exclude<Provider, 'NONE'>, {
  label:       string;
  placeholder: string;
  hint:        string;
  pattern:     RegExp;
  patternMsg:  string;
}> = {
  NEQUI: {
    label:       'Número de celular',
    placeholder: '3123456789',
    hint:        'El número de 10 dígitos asociado a tu cuenta Nequi',
    pattern:     /^\d{10}$/,
    patternMsg:  'Debe ser exactamente 10 dígitos numéricos',
  },
  BANCOLOMBIA: {
    label:       'Número de cuenta',
    placeholder: '04130100123456789',
    hint:        'Número de cuenta Bancolombia (10 a 18 dígitos)',
    pattern:     /^\d{10,18}$/,
    patternMsg:  'Debe tener entre 10 y 18 dígitos numéricos',
  },
};

// ─── Estado inicial ───────────────────────────────────────────────────────────

const INITIAL: FormState = {
  name:              '',
  type:              AccountType.SAVINGS,
  balance:           '0',
  currency:          'COP',
  provider:          'NONE',
  externalAccountId: '',
};

// ─── Componente ───────────────────────────────────────────────────────────────

export function CreateAccountModal({ open, onClose, onSuccess }: Props) {
  const [form,      setForm]      = useState<FormState>(INITIAL);
  const [errors,    setErrors]    = useState<FormErrors>({});
  const [apiError,  setApiError]  = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Resetear al cerrar
  const handleClose = useCallback(() => {
    setForm(INITIAL);
    setErrors({});
    setApiError(null);
    onClose();
  }, [onClose]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    // Limpiar el error del campo cuando el usuario escribe
    if (key in errors) setErrors((prev) => ({ ...prev, [key]: undefined }));
    if (apiError)      setApiError(null);
  }

  // ── Validación ──────────────────────────────────────────────────────────────

  function validate(): boolean {
    const e: FormErrors = {};

    if (!form.name.trim() || form.name.trim().length < 2) {
      e.name = 'El nombre debe tener al menos 2 caracteres';
    }
    if (!form.type) {
      e.type = 'Selecciona un tipo de cuenta';
    }
    const numBalance = parseFloat(form.balance);
    if (isNaN(numBalance) || numBalance < 0) {
      e.balance = 'El saldo inicial debe ser 0 o mayor';
    }
    if (form.provider !== 'NONE') {
      const cfg = PROVIDER_ID_CONFIG[form.provider];
      if (!form.externalAccountId.trim()) {
        e.externalAccountId = `${cfg.label} es obligatorio para ${form.provider}`;
      } else if (!cfg.pattern.test(form.externalAccountId.trim())) {
        e.externalAccountId = cfg.patternMsg;
      }
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  }

  // ── Envío ───────────────────────────────────────────────────────────────────

  async function submit() {
    if (!validate()) return;
    setSubmitting(true);
    setApiError(null);

    const payload = {
      name:              form.name.trim(),
      type:              form.type as AccountType,
      balance:           parseFloat(form.balance) || 0,
      currency:          form.currency,
      provider:          form.provider === 'NONE' ? null : form.provider,
      externalAccountId: form.provider === 'NONE' || !form.externalAccountId.trim()
                           ? null
                           : form.externalAccountId.trim(),
    };

    try {
      const account = await apiPost<BankAccount>('/bank-accounts', payload);
      handleClose();
      onSuccess(account);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Error al crear la cuenta');
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Datos derivados ────────────────────────────────────────────────────────

  const idConfig = form.provider !== 'NONE' ? PROVIDER_ID_CONFIG[form.provider] : null;
  const providerColor: Record<Provider, string> = {
    NONE:        'text-slate-500',
    NEQUI:       'text-pink-600',
    BANCOLOMBIA: 'text-yellow-700',
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Nueva cuenta"
      description="Agrega una cuenta bancaria, de ahorros o digital"
    >
      <div className="px-6 py-5 space-y-5">

        {/* ── Nombre ─────────────────────────────────────────────────────── */}
        <Input
          label="Nombre de la cuenta"
          placeholder="Ej: Mi Nequi Principal, Ahorros Bancolombia…"
          value={form.name}
          onChange={(e) => setField('name', e.target.value)}
          error={errors.name}
          maxLength={60}
          autoFocus
        />

        {/* ── Tipo + Moneda (en fila) ─────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Tipo de cuenta"
            options={TYPE_OPTIONS}
            value={form.type}
            onChange={(e) => setField('type', e.target.value as AccountType)}
            error={errors.type}
          />
          <Select
            label="Moneda"
            options={CURRENCY_OPTIONS}
            value={form.currency}
            onChange={(e) => setField('currency', e.target.value)}
          />
        </div>

        {/* ── Saldo inicial ──────────────────────────────────────────────── */}
        <div>
          <Input
            label="Saldo inicial"
            type="number"
            min="0"
            step="1000"
            placeholder="0"
            value={form.balance}
            onChange={(e) => setField('balance', e.target.value)}
            error={errors.balance}
          />
          <p className="text-xs text-slate-400 mt-1">
            Puedes dejarlo en 0 y ajustarlo después.
          </p>
        </div>

        {/* ── Proveedor / Entidad ────────────────────────────────────────── */}
        <div>
          <Select
            label="Entidad / Proveedor"
            options={PROVIDER_OPTIONS}
            value={form.provider}
            onChange={(e) => {
              setField('provider', e.target.value as Provider);
              setField('externalAccountId', '');
            }}
          />
          {form.provider !== 'NONE' && (
            <p className={`text-xs mt-1.5 font-medium ${providerColor[form.provider]}`}>
              {form.provider === 'NEQUI'
                ? '📱 Se vinculará al simulador Nequi por número de celular'
                : '🏦 Se vinculará al simulador Bancolombia por número de cuenta'}
            </p>
          )}
        </div>

        {/* ── Número de identificación (dinámico según proveedor) ─────────── */}
        {idConfig && (
          <div>
            <Input
              label={idConfig.label}
              placeholder={idConfig.placeholder}
              inputMode="numeric"
              value={form.externalAccountId}
              onChange={(e) =>
                setField('externalAccountId', e.target.value.replace(/\D/g, ''))
              }
              error={errors.externalAccountId}
              maxLength={18}
            />
            <p className="text-xs text-slate-400 mt-1">{idConfig.hint}</p>
          </div>
        )}

        {/* ── Preview de la cuenta que se va a crear ──────────────────────── */}
        {form.name.trim() && form.type && (
          <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3">
            <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">
              Vista previa
            </p>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-slate-800">{form.name.trim()}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {TYPE_OPTIONS.find(o => o.value === form.type)?.label.replace(/^[\S]+\s+/, '')}
                  {form.provider !== 'NONE' ? ` · ${form.provider}` : ''}
                  {form.externalAccountId ? ` · ${form.externalAccountId}` : ''}
                </p>
              </div>
              <p className="text-sm font-bold text-slate-700 tabular-nums">
                {new Intl.NumberFormat('es-CO', {
                  style: 'currency', currency: form.currency, maximumFractionDigits: 0,
                }).format(parseFloat(form.balance) || 0)}
              </p>
            </div>
          </div>
        )}

        {/* ── Error de API ────────────────────────────────────────────────── */}
        {apiError && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
            <span>⚠️</span>
            <span>{apiError}</span>
          </div>
        )}
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <div className="sticky bottom-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-6 py-4 flex gap-3">
        <Button
          variant="ghost"
          onClick={handleClose}
          fullWidth
          className="border border-slate-200 dark:border-slate-700"
        >
          Cancelar
        </Button>
        <Button
          onClick={submit}
          loading={submitting}
          fullWidth
        >
          {submitting ? 'Creando…' : 'Crear cuenta'}
        </Button>
      </div>
    </Modal>
  );
}
