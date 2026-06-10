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
  const [selectedAcct,  setSelectedAcct]  = useState(accounts[0]?.id ?? '');
  const [selectedCat,   setSelectedCat]   = useState('');

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

  const handleConfirm = () => {
    if (!selectedAcct || !selectedCat) return;
    onConfirm({
      bankAccountId: selectedAcct,
      categoryId:    selectedCat,
      description:   `[DIAN] ${invoice.emisor ?? 'Factura electrónica'}${invoice.nit ? ` · NIT ${invoice.nit}` : ''}${invoice.cufe ? ` · ${invoice.cufe.slice(0, 10)}…` : ''}`,
      amount:        invoice.total ?? 0,
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
          <div className="col-span-2">
            <BentoCell label="Total a pagar" value={fmt(invoice.total)} highlight />
          </div>
        </div>

        {/* Cuenta */}
        <Select
          label="Cuenta a debitar"
          options={accounts.map(a => ({
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
            disabled={saving || !selectedAcct || !selectedCat || invoice.total == null}
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
