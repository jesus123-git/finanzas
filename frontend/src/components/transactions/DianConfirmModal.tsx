'use client';

import { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import { apiGet } from '@/lib/api';
import type { DianInvoiceData } from '@/hooks/useDianScanner';
import type { BankAccount } from '@/types/dashboard.types';

interface Category { id: string; name: string; }

interface Props {
  open:      boolean;
  invoice:   DianInvoiceData;
  accounts:  BankAccount[];
  saving:    boolean;
  error:     string | null;
  onCancel:  () => void;
  onConfirm: (payload: { bankAccountId: string; categoryId: string; description: string; amount: number }) => void;
}

function fmt(n: number | null) {
  if (n == null) return '—';
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
}

function BentoCell({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl p-3.5 border ${highlight
      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800'
      : 'bg-slate-50 dark:bg-slate-700/50 border-slate-100 dark:border-slate-700'}`}
    >
      <p className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-sm font-semibold truncate ${highlight ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-800 dark:text-slate-100'}`}>
        {value}
      </p>
    </div>
  );
}

export function DianConfirmModal({ open, invoice, accounts, saving, error, onCancel, onConfirm }: Props) {
  const [categories,    setCategories]    = useState<Category[]>([]);
  const [loadingCats,   setLoadingCats]   = useState(true);
  const [selectedAcct,  setSelectedAcct]  = useState(accounts?.[0]?.id ?? '');
  const [selectedCat,   setSelectedCat]   = useState('');
  const [description,   setDescription]   = useState('');
  const [amountStr,     setAmountStr]     = useState('');

  // Pre-llenar descripción y monto editables con lo extraído de la factura
  useEffect(() => {
    if (!open) return;
    setDescription(invoice.emisor ? `Compra en ${invoice.emisor}` : 'Factura electrónica DIAN');
    setAmountStr(invoice.total != null ? String(invoice.total) : '');
  }, [open, invoice.emisor, invoice.total]);

  // Cargar categorías al abrir el modal
  useEffect(() => {
    if (!open) return;
    setLoadingCats(true);
    apiGet<Category[]>('/categories')
      .then(cats => {
        setCategories(cats);
        // Pre-seleccionar categoría sugerida por IA
        const match = cats.find(c => c.name.toLowerCase() === invoice.categoria.toLowerCase())
                   ?? cats.find(c => invoice.categoria.toLowerCase().includes(c.name.toLowerCase()))
                   ?? cats[0];
        setSelectedCat(match?.id ?? '');
      })
      .catch(() => setCategories([]))
      .finally(() => setLoadingCats(false));
  }, [open, invoice.categoria]);

  const amount = parseFloat(amountStr);
  const amountValid = !isNaN(amount) && amount > 0;

  const handleConfirm = () => {
    if (!selectedAcct || !selectedCat || !amountValid || !description.trim()) return;
    // Referencia DIAN (NIT/CUFE) se anexa a la descripción del usuario para trazabilidad
    const ref = [invoice.nit && `NIT ${invoice.nit}`, invoice.cufe && `CUFE ${invoice.cufe.slice(0, 8)}…`]
      .filter(Boolean).join(' · ');
    onConfirm({
      bankAccountId: selectedAcct,
      categoryId:    selectedCat,
      description:   ref ? `${description.trim()} [${ref}]`.slice(0, 200) : description.trim().slice(0, 200),
      amount,
    });
  };

  const suggestedName = categories.find(c => c.id === selectedCat)?.name ?? invoice.categoria;

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title="Factura DIAN detectada"
      description="Revisa los datos extraídos antes de guardar"
      maxWidth="max-w-xl"
    >
      <div className="px-6 py-5 space-y-4">

        {/* Banner MaIA */}
        <div className="flex items-center gap-3 rounded-xl bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 px-4 py-3">
          <span className="text-lg" aria-hidden>🤖</span>
          <p className="text-sm text-violet-700 dark:text-violet-300">
            MaIA leyó los datos oficiales de la DIAN · Categoría sugerida:{' '}
            <span className="font-bold">{suggestedName}</span>
          </p>
        </div>

        {/* Bento grid de datos */}
        <div className="grid grid-cols-2 gap-2">
          <div className="col-span-2">
            <BentoCell label="Comercio / Emisor" value={invoice.emisor ?? 'No detectado'} />
          </div>
          <BentoCell label="NIT"      value={invoice.nit   ?? '—'} />
          <BentoCell label="Fecha"    value={invoice.fecha  ?? '—'} />
          <BentoCell label="Subtotal" value={fmt(invoice.subtotal)} />
          <BentoCell label="IVA"      value={fmt(invoice.iva)} />
        </div>

        {/* ── Detalle de productos (factura traducida) ─────────────────── */}
        {invoice.items.length > 0 ? (
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                🛒 Productos de la factura ({invoice.items.length})
              </p>
            </div>
            <div className="max-h-44 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/60">
              {invoice.items.map((item, i) => (
                <div key={i} className="flex items-center justify-between gap-3 px-4 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-700 dark:text-slate-200 truncate">{item.descripcion}</p>
                    {(item.cantidad != null || item.precioUnitario != null) && (
                      <p className="text-xs text-slate-400 dark:text-slate-500">
                        {item.cantidad != null && `${item.cantidad} und`}
                        {item.cantidad != null && item.precioUnitario != null && ' × '}
                        {item.precioUnitario != null && fmt(item.precioUnitario)}
                      </p>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex-shrink-0">
                    {fmt(item.total ?? item.precioUnitario)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-400 dark:text-slate-500 px-1">
            La DIAN no publica el detalle de productos para esta factura — solo los totales.
          </p>
        )}

        {/* Total final */}
        <div className="rounded-xl p-3.5 border bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
          <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">Total a pagar</p>
          <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{fmt(invoice.total)}</p>
        </div>

        {/* ── ¿De qué fue el gasto? (editable) ─────────────────────────── */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            ¿De qué fue el gasto?
          </label>
          <input
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            maxLength={160}
            placeholder="Ej: Mercado de la semana"
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition text-sm"
          />
        </div>

        {/* ── Monto a registrar (editable, pre-llenado con el total) ────── */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Monto a registrar
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
            <input
              type="number"
              min="1"
              step="1"
              value={amountStr}
              onChange={e => setAmountStr(e.target.value)}
              placeholder={invoice.total == null ? 'La DIAN no publicó el total — escríbelo' : '0'}
              className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition text-sm"
            />
          </div>
          {invoice.total != null && amountValid && amount !== invoice.total && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
              ⚠️ El monto difiere del total de la factura ({fmt(invoice.total)})
            </p>
          )}
        </div>

        {/* Cuenta */}
        <Select
          label="Cuenta a debitar"
          options={(accounts ?? []).map(a => ({
            value: a.id,
            label: `${a.name} · ${fmt(a.balance)}`,
          }))}
          value={selectedAcct}
          onChange={e => setSelectedAcct(e.target.value)}
        />

        {/* Categoría — preseleccionada con sugerencia IA */}
        {loadingCats ? (
          <div className="h-16 rounded-xl bg-slate-100 dark:bg-slate-700 animate-pulse" />
        ) : (
          <div className="space-y-1.5">
            <Select
              label="Categoría"
              options={categories.map(c => ({ value: c.id, label: c.name }))}
              value={selectedCat}
              onChange={e => setSelectedCat(e.target.value)}
            />
            {selectedCat && categories.find(c => c.id === selectedCat)?.name.toLowerCase() === invoice.categoria.toLowerCase() && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <span>✓</span> MaIA acertó la categoría — puedes cambiarla si no es correcta
              </p>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
            ⚠️ {error}
          </p>
        )}

        {/* Acciones */}
        <div className="flex gap-3 pt-1">
          <Button
            variant="ghost"
            onClick={onCancel}
            disabled={saving}
            className="flex-1 border border-slate-200 dark:border-slate-600"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={saving || !selectedAcct || !selectedCat || !amountValid || !description.trim()}
            className="flex-1 gap-2"
          >
            {saving ? (
              <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Guardando…</>
            ) : (
              <>✨ Confirmar y guardar</>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
