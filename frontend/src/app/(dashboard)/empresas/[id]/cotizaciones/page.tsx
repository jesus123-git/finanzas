'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/axios';
import Link from 'next/link';
import { ArrowLeft, Plus, X, FileText, Trash2, ArrowRight, CheckCircle } from 'lucide-react';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Customer { id: string; name: string; nit?: string }
interface Product { id: string; name: string; price: number; taxRate: number; unit: string }
interface QuoteItem { description: string; quantity: number; unitPrice: number; taxRate: number; total: number; product?: { name: string } }
interface Quote {
  id: string; number: string; status: string;
  validUntil?: string; notes?: string;
  subtotal: number; tax: number; total: number;
  customer?: { id: string; name: string };
  items: QuoteItem[];
  invoice?: { id: string; number: string };
  _count?: { items: number };
  createdAt: string;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const itemSchema = z.object({
  productId: z.string().optional(),
  description: z.string().min(1, 'Requerido'),
  quantity: z.coerce.number().min(0.001),
  unitPrice: z.coerce.number().min(0),
  taxRate: z.coerce.number().min(0).max(100),
});

const schema = z.object({
  customerId: z.string().optional(),
  validUntil: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(itemSchema).min(1, 'Agrega al menos un ítem'),
});

type FormData = z.infer<typeof schema>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCOP(n: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  DRAFT:    { label: 'Borrador',  color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
  SENT:     { label: 'Enviada',   color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400' },
  ACCEPTED: { label: 'Aceptada', color: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' },
  REJECTED: { label: 'Rechazada',color: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400' },
  INVOICED: { label: 'Facturada', color: 'bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400' },
};

const inputCls = 'w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition';
const inputSmCls = 'w-full px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition';

// ─── Componente ───────────────────────────────────────────────────────────────

export default function QuotesPage() {
  const { id: businessId } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ type: 'delete' | 'convert'; id: string; number: string } | null>(null);

  const { data: quotes, isLoading } = useQuery({
    queryKey: ['quotes', businessId],
    queryFn: async () => (await api.get<Quote[]>(`/businesses/${businessId}/quotes`)).data,
    enabled: !!businessId,
  });

  const { data: customers } = useQuery({
    queryKey: ['customers', businessId],
    queryFn: async () => (await api.get<Customer[]>(`/businesses/${businessId}/customers`)).data,
    enabled: !!businessId,
  });

  const { data: products } = useQuery({
    queryKey: ['products', businessId, 'ALL'],
    queryFn: async () => (await api.get<Product[]>(`/businesses/${businessId}/products`)).data,
    enabled: !!businessId,
  });

  const { register, handleSubmit, control, watch, reset, setValue, formState: { isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { items: [{ description: '', quantity: 1, unitPrice: 0, taxRate: 19 }] },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const watchedItems = watch('items');

  const subtotal = watchedItems?.reduce((s, i) => s + (Number(i.quantity) * Number(i.unitPrice)), 0) ?? 0;
  const tax = watchedItems?.reduce((s, i) => s + (Number(i.quantity) * Number(i.unitPrice) * Number(i.taxRate) / 100), 0) ?? 0;
  const total = subtotal + tax;

  // Autocompletar ítem al seleccionar producto
  const onProductSelect = (index: number, productId: string) => {
    const p = products?.find(p => p.id === productId);
    if (p) {
      setValue(`items.${index}.description`, p.name);
      setValue(`items.${index}.unitPrice`, Number(p.price));
      setValue(`items.${index}.taxRate`, Number(p.taxRate));
    }
  };

  const createMutation = useMutation({
    mutationFn: (data: FormData) => api.post(`/businesses/${businessId}/quotes`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes', businessId] });
      setShowForm(false);
      reset();
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ quoteId, status }: { quoteId: string; status: string }) =>
      api.patch(`/businesses/${businessId}/quotes/${quoteId}/status`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['quotes', businessId] }),
  });

  const convertMutation = useMutation({
    mutationFn: (quoteId: string) =>
      api.post(`/businesses/${businessId}/quotes/${quoteId}/convert`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes', businessId] });
      queryClient.invalidateQueries({ queryKey: ['invoices', businessId] });
      setConfirmAction(null);
      router.push(`/empresas/${businessId}/facturas`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (quoteId: string) => api.delete(`/businesses/${businessId}/quotes/${quoteId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes', businessId] });
      setConfirmAction(null);
    },
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <nav className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href={`/empresas/${businessId}`} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition">
              <ArrowLeft size={20} />
            </Link>
            <span className="font-semibold text-gray-900 dark:text-white">Cotizaciones</span>
          </div>
          <ThemeToggle />
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Cotizaciones</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">{quotes?.length ?? 0} registradas</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg font-medium transition"
          >
            <Plus size={18} /> Nueva cotización
          </button>
        </div>

        {/* Modal nueva cotización */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-2xl p-6 shadow-xl border border-gray-100 dark:border-gray-800 my-8">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Nueva cotización</h2>
                <button onClick={() => { setShowForm(false); reset(); }} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-5">
                {/* Cliente + Vigencia */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cliente</label>
                    <select {...register('customerId')} className={inputCls}>
                      <option value="">Sin cliente</option>
                      {customers?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Válida hasta</label>
                    <input {...register('validUntil')} type="date" className={inputCls} />
                  </div>
                </div>

                {/* Ítems */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Ítems</label>
                    <button type="button" onClick={() => append({ description: '', quantity: 1, unitPrice: 0, taxRate: 19 })} className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 flex items-center gap-1">
                      <Plus size={14} /> Agregar ítem
                    </button>
                  </div>

                  <div className="space-y-3">
                    {fields.map((field, index) => (
                      <div key={field.id} className="space-y-2">
                        {/* Selector de producto */}
                        <select
                          onChange={(e) => onProductSelect(index, e.target.value)}
                          className={`${inputSmCls} text-gray-400 dark:text-gray-500`}
                        >
                          <option value="">— Seleccionar del catálogo (opcional) —</option>
                          {products?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>

                        <div className="grid grid-cols-12 gap-2 items-start">
                          <div className="col-span-5">
                            <input {...register(`items.${index}.description`)} placeholder="Descripción" className={inputSmCls} />
                          </div>
                          <div className="col-span-2">
                            <input {...register(`items.${index}.quantity`)} type="number" placeholder="Cant." min="0.001" step="0.001" className={inputSmCls} />
                          </div>
                          <div className="col-span-2">
                            <input {...register(`items.${index}.unitPrice`)} type="number" placeholder="Precio" min="0" className={inputSmCls} />
                          </div>
                          <div className="col-span-2">
                            <select {...register(`items.${index}.taxRate`)} className={inputSmCls}>
                              <option value={0}>0% IVA</option>
                              <option value={5}>5% IVA</option>
                              <option value={19}>19% IVA</option>
                            </select>
                          </div>
                          <div className="col-span-1 flex justify-center pt-2">
                            {fields.length > 1 && (
                              <button type="button" onClick={() => remove(index)} className="text-red-400 hover:text-red-600">
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Totales */}
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 space-y-1 text-sm">
                  <div className="flex justify-between text-gray-500 dark:text-gray-400"><span>Subtotal</span><span>{formatCOP(subtotal)}</span></div>
                  <div className="flex justify-between text-gray-500 dark:text-gray-400"><span>IVA</span><span>{formatCOP(tax)}</span></div>
                  <div className="flex justify-between font-bold text-gray-900 dark:text-white text-base pt-1 border-t border-gray-200 dark:border-gray-700"><span>Total</span><span>{formatCOP(total)}</span></div>
                </div>

                {/* Notas */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notas</label>
                  <textarea {...register('notes')} rows={2} placeholder="Condiciones, vigencia, etc." className={`${inputCls} resize-none text-sm`} />
                </div>

                <div className="flex gap-3">
                  <button type="button" onClick={() => { setShowForm(false); reset(); }} className="flex-1 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 py-2.5 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition">Cancelar</button>
                  <button type="submit" disabled={isSubmitting} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-2.5 rounded-lg font-medium transition">
                    {isSubmitting ? 'Creando...' : 'Crear cotización'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Confirmaciones */}
        <ConfirmDialog
          open={confirmAction?.type === 'delete'}
          title="Eliminar cotización"
          message={`¿Eliminar la cotización ${confirmAction?.number}? Esta acción no se puede deshacer.`}
          onConfirm={() => confirmAction && deleteMutation.mutate(confirmAction.id)}
          onCancel={() => setConfirmAction(null)}
        />
        <ConfirmDialog
          open={confirmAction?.type === 'convert'}
          title="Convertir en factura"
          message={`¿Convertir la cotización ${confirmAction?.number} en factura? Se generará automáticamente con numeración FV.`}
          confirmLabel="Convertir"
          onConfirm={() => confirmAction && convertMutation.mutate(confirmAction.id)}
          onCancel={() => setConfirmAction(null)}
        />

        {/* Lista */}
        {isLoading ? (
          <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-5 animate-pulse h-24" />)}</div>
        ) : quotes?.length === 0 ? (
          <div className="text-center py-16">
            <FileText size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
            <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">No hay cotizaciones aún</h3>
            <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition">
              <Plus size={18} /> Crear primera cotización
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {quotes?.map((quote) => {
              const st = STATUS_CONFIG[quote.status];
              const isExpired = quote.validUntil && new Date(quote.validUntil) < new Date() && quote.status !== 'INVOICED';
              return (
                <div key={quote.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <span className="font-semibold text-gray-900 dark:text-white">{quote.number}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.color}`}>{st.label}</span>
                        {isExpired && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Vencida</span>
                        )}
                      </div>
                      {quote.customer && <p className="text-sm text-gray-500 dark:text-gray-400">{quote.customer.name}</p>}
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-400 dark:text-gray-500">
                        <span>{formatDate(quote.createdAt)}</span>
                        {quote.validUntil && <span>Válida hasta: {formatDate(quote.validUntil)}</span>}
                        {quote.invoice && (
                          <Link href={`/empresas/${businessId}/invoices`} className="text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1">
                            Factura {quote.invoice.number} <ArrowRight size={11} />
                          </Link>
                        )}
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0 ml-4">
                      <p className="font-bold text-gray-900 dark:text-white text-lg">{formatCOP(Number(quote.total))}</p>

                      {/* Acciones según estado */}
                      <div className="flex flex-col items-end gap-1 mt-2">
                        {quote.status === 'DRAFT' && (
                          <button onClick={() => statusMutation.mutate({ quoteId: quote.id, status: 'SENT' })} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
                            Marcar como enviada →
                          </button>
                        )}
                        {quote.status === 'SENT' && (
                          <>
                            <button onClick={() => statusMutation.mutate({ quoteId: quote.id, status: 'ACCEPTED' })} className="text-xs text-green-600 dark:text-green-400 hover:underline">
                              Marcar como aceptada ✓
                            </button>
                            <button onClick={() => statusMutation.mutate({ quoteId: quote.id, status: 'REJECTED' })} className="text-xs text-red-500 dark:text-red-400 hover:underline">
                              Marcar como rechazada ✗
                            </button>
                          </>
                        )}
                        {quote.status === 'ACCEPTED' && (
                          <button
                            onClick={() => setConfirmAction({ type: 'convert', id: quote.id, number: quote.number })}
                            className="flex items-center gap-1.5 text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg transition font-medium"
                          >
                            <CheckCircle size={13} /> Convertir en factura
                          </button>
                        )}
                        {quote.status !== 'INVOICED' && (
                          <button
                            onClick={() => setConfirmAction({ type: 'delete', id: quote.id, number: quote.number })}
                            className="text-xs text-gray-400 hover:text-red-500 dark:hover:text-red-400 mt-1"
                          >
                            Eliminar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
