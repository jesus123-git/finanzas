'use client';

import { useState } from 'react';
import type { BankAccount } from '@/types/dashboard.types';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Props {
  accounts: BankAccount[];
  onSuccess: () => void;
}

type TxType = 'INCOME' | 'EXPENSE';
type Provider = 'NEQUI' | 'BANCOLOMBIA';

interface Preset {
  label:    string;
  amount:   number;
  type:     TxType;
  icon:     string;
  color:    'emerald' | 'rose';
}

interface SimResult {
  ok:      boolean;
  message: string;
}

// ─── Configuración por entidad ────────────────────────────────────────────────

const BANK_CONFIG: Record<Provider, {
  label:      string;
  shortLabel: string;
  color:      string;           // clases Tailwind del gradiente/border
  headerBg:   string;
  endpoint:   string;
  idField:    string;           // campo que se envía en el body
  idLabel:    string;           // texto para las instrucciones
  idExample:  string;
  presets:    Preset[];
}> = {
  NEQUI: {
    label:      'Nequi',
    shortLabel: 'N',
    color:      'from-pink-500 to-purple-600',
    headerBg:   'from-pink-50 to-purple-50 border-pink-200',
    endpoint:   '/api/v1/webhooks/nequi',
    idField:    'phoneNumber',
    idLabel:    'número de celular',
    idExample:  '3123456789',
    presets: [
      { label: '+$50.000',   amount: 50_000,  type: 'INCOME',  icon: '📥', color: 'emerald' },
      { label: '+$200.000',  amount: 200_000, type: 'INCOME',  icon: '📥', color: 'emerald' },
      { label: '−$15.000',   amount: 15_000,  type: 'EXPENSE', icon: '📤', color: 'rose'    },
      { label: '−$80.000',   amount: 80_000,  type: 'EXPENSE', icon: '📤', color: 'rose'    },
    ],
  },
  BANCOLOMBIA: {
    label:      'Bancolombia',
    shortLabel: 'B',
    color:      'from-yellow-500 to-amber-600',
    headerBg:   'from-yellow-50 to-amber-50 border-yellow-200',
    endpoint:   '/api/v1/webhooks/bancolombia',
    idField:    'accountNumber',
    idLabel:    'número de cuenta (10-18 dígitos)',
    idExample:  '04130100123456789',
    presets: [
      { label: '+$200.000',  amount: 200_000, type: 'INCOME',  icon: '📥', color: 'emerald' },
      { label: '+$500.000',  amount: 500_000, type: 'INCOME',  icon: '📥', color: 'emerald' },
      { label: '−$85.000',   amount: 85_000,  type: 'EXPENSE', icon: '📤', color: 'rose'    },
      { label: '−$150.000',  amount: 150_000, type: 'EXPENSE', icon: '📤', color: 'rose'    },
    ],
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', maximumFractionDigits: 0,
  }).format(n);
}

// ─── Sub-panel por entidad ────────────────────────────────────────────────────

function EntityPanel({
  provider,
  account,
  onSuccess,
}: {
  provider: Provider;
  account:  BankAccount;
  onSuccess: () => void;
}) {
  const cfg = BANK_CONFIG[provider];
  const [busy,   setBusy]   = useState(false);
  const [result, setResult] = useState<SimResult | null>(null);

  async function fire(preset: Preset) {
    setBusy(true);
    setResult(null);

    const secret = process.env.NEXT_PUBLIC_WEBHOOK_SECRET ?? '';
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

    const desc = preset.type === 'INCOME'
      ? `Simulación: abono de ${fmt(preset.amount)} vía ${cfg.label}`
      : `Simulación: débito de ${fmt(preset.amount)} vía ${cfg.label}`;

    const body: Record<string, unknown> = {
      [cfg.idField]: account.externalAccountId!,
      amount:        preset.amount,
      type:          preset.type,
      description:   desc,
      timestamp:     new Date().toISOString(),
      transactionId: `SIM-${provider.slice(0, 3)}-${Date.now()}`,
    };

    try {
      const res = await fetch(`${apiUrl}${cfg.endpoint}`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'X-Webhook-Auth': secret,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { message?: string | string[] };
        const msg = Array.isArray(err.message) ? err.message.join(', ') : (err.message ?? `Error ${res.status}`);
        throw new Error(msg);
      }

      const data = await res.json() as { accountName: string };
      setResult({ ok: true, message: `✓ ${desc} — "${data.accountName}"` });
      setTimeout(onSuccess, 350);
    } catch (e) {
      setResult({ ok: false, message: e instanceof Error ? e.message : 'Error desconocido' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`rounded-2xl border bg-gradient-to-br ${cfg.headerBg} overflow-hidden`}>
      {/* Cabecera */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/50">
        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${cfg.color} flex items-center justify-center text-white text-xs font-bold shadow-sm`}>
          {cfg.shortLabel}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-800 leading-tight">{cfg.label}</p>
          <p className="text-[11px] text-slate-500 truncate">
            {account.name} · {account.externalAccountId}
          </p>
        </div>
        <span className="text-[11px] font-semibold text-slate-500 bg-white/60 px-2 py-0.5 rounded-full tabular-nums">
          {fmt(account.balance)}
        </span>
      </div>

      {/* Botones de simulación */}
      <div className="p-3 grid grid-cols-2 gap-2">
        {cfg.presets.map((p) => (
          <button
            key={`${p.type}-${p.amount}`}
            disabled={busy}
            onClick={() => fire(p)}
            className={`
              flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold
              transition-all border disabled:opacity-40 disabled:cursor-not-allowed
              ${p.color === 'emerald'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                : 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
              }
            `}
          >
            <span className="text-sm">{p.icon}</span>
            <span>{p.label}</span>
          </button>
        ))}
      </div>

      {/* Feedback */}
      {busy && (
        <div className="mx-3 mb-3 flex items-center gap-2 text-xs text-slate-500 bg-white/60 rounded-xl px-3 py-2">
          <svg className="animate-spin h-3.5 w-3.5 text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Procesando…
        </div>
      )}
      {result && !busy && (
        <p className={`mx-3 mb-3 text-[11px] rounded-xl px-3 py-2 font-medium leading-snug ${
          result.ok
            ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
            : 'bg-red-50 border border-red-200 text-red-700'
        }`}>
          {result.message}
        </p>
      )}
    </div>
  );
}

// ─── Panel maestro ────────────────────────────────────────────────────────────

export function BankSimulatorPanel({ accounts, onSuccess }: Props) {
  const [expanded, setExpanded] = useState(false);

  const nequiAccounts       = accounts.filter(a => a.provider?.toUpperCase() === 'NEQUI'       && a.externalAccountId);
  const bancolombiaAccounts = accounts.filter(a => a.provider?.toUpperCase() === 'BANCOLOMBIA' && a.externalAccountId);

  const hasAny = nequiAccounts.length > 0 || bancolombiaAccounts.length > 0;

  // ── Sin cuentas configuradas ──────────────────────────────────────────────
  if (!hasAny) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 space-y-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🏦</span>
          <p className="font-semibold text-slate-600 text-sm">Simulador Open Banking</p>
        </div>
        <p className="text-xs text-slate-500">
          Para activar el simulador, crea cuentas con los siguientes valores:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(Object.entries(BANK_CONFIG) as [Provider, typeof BANK_CONFIG[Provider]][]).map(([prov, cfg]) => (
            <div key={prov} className={`rounded-xl border bg-gradient-to-br p-3 ${cfg.headerBg}`}>
              <p className="text-xs font-bold text-slate-700 mb-1.5">{cfg.label}</p>
              <ul className="space-y-0.5 text-[11px] text-slate-500 list-disc list-inside">
                <li><code className="bg-white/80 px-1 rounded">provider = "{prov}"</code></li>
                <li><code className="bg-white/80 px-1 rounded">externalAccountId</code> = {cfg.idLabel}</li>
                <li>Ejemplo: <code className="bg-white/80 px-1 rounded">{cfg.idExample}</code></li>
              </ul>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Con al menos una cuenta ───────────────────────────────────────────────
  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
      {/* Cabecera colapsable */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex -space-x-1.5">
            {nequiAccounts.length > 0 && (
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-white text-[10px] font-bold shadow ring-2 ring-white">N</div>
            )}
            {bancolombiaAccounts.length > 0 && (
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-yellow-500 to-amber-600 flex items-center justify-center text-white text-[10px] font-bold shadow ring-2 ring-white">B</div>
            )}
          </div>
          <div className="text-left">
            <p className="text-sm font-bold text-slate-800">Simulador Open Banking</p>
            <p className="text-xs text-slate-500">
              {[
                nequiAccounts.length       > 0 && 'Nequi',
                bancolombiaAccounts.length > 0 && 'Bancolombia',
              ].filter(Boolean).join(' · ')}
              {' '}· Solo visible en desarrollo
            </p>
          </div>
        </div>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-4 w-4 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Contenido */}
      {expanded && (
        <div className="px-5 pb-5 pt-1 space-y-4 border-t border-slate-100">
          {nequiAccounts.map(acc => (
            <EntityPanel key={acc.id} provider="NEQUI" account={acc} onSuccess={onSuccess} />
          ))}
          {bancolombiaAccounts.map(acc => (
            <EntityPanel key={acc.id} provider="BANCOLOMBIA" account={acc} onSuccess={onSuccess} />
          ))}

          <p className="text-[11px] text-slate-400 leading-relaxed pt-1">
            Cada botón llama <code className="bg-slate-100 px-1 rounded">POST /api/v1/webhooks/&lt;entidad&gt;</code> con{' '}
            <code className="bg-slate-100 px-1 rounded">X-Webhook-Auth</code> — idéntico a cómo lo haría la entidad real.
          </p>
        </div>
      )}
    </div>
  );
}
