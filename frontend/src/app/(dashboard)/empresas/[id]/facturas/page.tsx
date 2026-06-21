'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/axios';
import Link from 'next/link';
import { ArrowLeft, Plus, X, FileText, Trash2 } from 'lucide-react';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Customer { id: string; name: string; nit?: string; email?: string }
interface Product { id: string; name: string; price: number; taxRate: number; unit: string; type: string }
interface InvoiceItem { description: string; quantity: number; unitPrice: number; taxRate: number; total: number }
interface Invoice {
  id: string;
  number: string;
  status: string;
  total: number;
  dueDate?: string;
  createdAt: string;
  customer?: Customer;
  items: InvoiceItem[];
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
  dueDate: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(itemSchema).min(1, 'Agrega al menos un ítem'),
});

type FormData = z.infer<typeof schema>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  DRAFT:     { label: 'Borrador',  color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
  SENT:      { label: 'Enviada',   color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400' },
  VIEWED:    { label: 'Vista',     color: 'bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400' },
  PAID:      { label: 'Pagada',    color: 'bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400' },
  OVERDUE:   { label: 'Vencida',   color: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400' },
  CANCELLED: { label: 'Cancelada', color: 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500' },
};

function formatCOP(amount: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(amount);
}

const inputCls = 'w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition';
const inputSmCls = 'w-full px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition';

// ─── Componente ───────────────────────────────────────────────────────────────

export default function InvoicesPage() {
  const { id: businessId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; number: string } | null>(null);

  // ─── Queries ────────────────────────────────────────────────────────────────

  const { data: invoices, isLoading } = useQuery({
    queryKey: ['invoices', businessId],
    queryFn: async () => (await api.get<Invoice[]>(`/businesses/${businessId}/invoices`)).data,
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

  // ─── Form ────────────────────────────────────────────────────────────────────

  const { register, handleSubmit, control, watch, reset, setValue, formState: { isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { items: [{ description: '', quantity: 1, unitPrice: 0, taxRate: 19 }] },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const watchedItems = watch('items');

  const subtotal = watchedItems?.reduce((s, i) => s + (Number(i.quantity) * Number(i.unitPrice)), 0) ?? 0;
  const tax = watchedItems?.reduce((s, i) => s + (Number(i.quantity) * Number(i.unitPrice) * Number(i.taxRate) / 100), 0) ?? 0;
  const total = subtotal + tax;

  const onProductSelect = (index: number, productId: string) => {
    const p = products?.find(p => p.id === productId);
    if (p) {
      setValue(`items.${index}.productId`, productId);
      setValue(`items.${index}.description`, p.name);
      setValue(`items.${index}.unitPrice`, Number(p.price));
      setValue(`items.${index}.taxRate`, Number(p.taxRate));
    } else {
      setValue(`items.${index}.productId`, undefined);
    }
  };

  // ─── Mutations ───────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (data: FormData) => api.post(`/businesses/${businessId}/invoices`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices', businessId] });
      queryClient.invalidateQueries({ queryKey: ['business-dashboard', businessId] });
      queryClient.invalidateQueries({ queryKey: ['products', businessId] });
      reset();
      setShowForm(false);
    },
  });

  const updateStatus = useMutation({
    mutationFn: ({ invoiceId, status }: { invoiceId: string; status: string }) =>
      api.patch(`/businesses/${businessId}/invoices/${invoiceId}/status`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invoices', businessId] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (invoiceId: string) => api.delete(`/businesses/${businessId}/invoices/${invoiceId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices', businessId] });
      queryClient.invalidateQueries({ queryKey: ['business-dashboard', businessId] });
      setConfirmDelete(null);
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
            <span className="font-semibold text-gray-900 dark:text-white">Facturas</span>
          </div>
          <ThemeToggle />
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Facturas</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">{invoices?.length ?? 0} emitidas</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg font-medium transition"
          >
            <Plus size={18} /> Nueva factura
          </button>
        </div>

        {/* Modal nueva factura */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-2xl p-6 shadow-xl border border-gray-100 dark:border-gray-800 my-8">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Nueva factura</h2>
                <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cliente</label>
                    <select {...register('customerId')} className={inputCls}>
                      <option value="">Sin cliente</option>
                      {customers?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Fecha de vencimiento</label>
                    <input {...register('dueDate')} type="date" className={inputCls} />
                  </div>
                </div>

                {/* Ítems */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Ítems</label>
                    <button
                      type="button"
                      onClick={() => append({ description: '', quantity: 1, unitPrice: 0, taxRate: 19 })}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 flex items-center gap-1"
                    >
                      <Plus size={14} /> Agregar ítem
                    </button>
                  </div>

                  <div className="space-y-3">
                    {fields.map((field, index) => (
                      <div key={field.id} className="space-y-2">
                        {/* Selector del catálogo */}
                        <select
                          value={watchedItems?.[index]?.productId ?? ''}
                          onChange={(e) => onProductSelect(index, e.target.value)}
                          className={`${inputSmCls} text-gray-400 dark:text-gray-500`}
                        >
                          <option value="">— Seleccionar del catálogo (opcional) —</option>
                          {products?.map(p => (
                            <option key={p.id} value={p.id}>
                              {p.name} — {formatCOP(Number(p.price))}
                              {p.type === 'PRODUCT' ? '' : ' (servicio)'}
                            </option>
                          ))}
                        </select>

                        <div className="grid grid-cols-12 gap-2 items-start">
                          <div className="col-span-5">
                            <input
                              {...register(`items.${index}.description`)}
                              placeholder="Descripción"
                              className={inputSmCls}
                            />
                          </div>
                          <div className="col-span-2">
                            <input
                              {...register(`items.${index}.quantity`)}
                              type="number"
                              placeholder="Cant."
                              min="0.001"
                              step="0.001"
                              className={inputSmCls}
                            />
                          </div>
                          <div className="col-span-2">
                            <input
                              {...register(`items.${index}.unitPrice`)}
                              type="number"
                              placeholder="Precio"
                              min="0"
                              className={inputSmCls}
                            />
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
                              <button
                                type="button"
                                onClick={() => remove(index)}
                                className="text-red-400 hover:text-red-600"
                              >
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
                  <div className="flex justify-between text-gray-500 dark:text-gray-400">
                    <span>Subtotal</span><span>{formatCOP(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-gray-500 dark:text-gray-400">
                    <span>IVA</span><span>{formatCOP(tax)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-gray-900 dark:text-white text-base pt-1 border-t border-gray-200 dark:border-gray-700">
                    <span>Total</span><span>{formatCOP(total)}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notas</label>
                  <textarea
                    {...register('notes')}
                    placeholder="Condiciones de pago..."
                    rows={2}
                    className={`${inputCls} resize-none text-sm`}
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="flex-1 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 py-2.5 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-2.5 rounded-lg font-medium transition"
                  >
                    {isSubmitting ? 'Creando...' : 'Crear factura'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Confirmación de eliminación */}
        <ConfirmDialog
          open={!!confirmDelete}
          title="Eliminar factura"
          message={`¿Eliminar la factura ${confirmDelete?.number}? Esta acción no se puede deshacer.`}
          onConfirm={() => confirmDelete && deleteMutation.mutate(confirmDelete.id)}
          onCancel={() => setConfirmDelete(null)}
        />

        {/* Lista de facturas */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-5 animate-pulse h-20" />
            ))}
          </div>
        ) : invoices?.length === 0 ? (
          <div className="text-center py-16">
            <FileText size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
            <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">No hay facturas aún</h3>
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition"
            >
              <Plus size={18} /> Nueva factura
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {invoices?.map((invoice) => {
              const status = STATUS_LABELS[invoice.status];
              return (
                <div
                  key={invoice.id}
                  className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-5 flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-semibold text-gray-900 dark:text-white">{invoice.number}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.color}`}>
                        {status.label}
                      </span>
                    </div>
                    {invoice.customer && (
                      <p className="text-sm text-gray-500 dark:text-gray-400">{invoice.customer.name}</p>
                    )}
                    {invoice.dueDate && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        Vence: {new Date(invoice.dueDate).toLocaleDateString('es-CO')}
                      </p>
                    )}
                  </div>

                  <div className="text-right flex items-center gap-4">
                    <div>
                      <p className="font-bold text-gray-900 dark:text-white">{formatCOP(Number(invoice.total))}</p>
                      {invoice.status === 'DRAFT' && (
                        <button
                          onClick={() => updateStatus.mutate({ invoiceId: invoice.id, status: 'SENT' })}
                          className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1"
                        >
                          Marcar como enviada →
                        </button>
                      )}
                      {invoice.status === 'SENT' && (
                        <button
                          onClick={() => updateStatus.mutate({ invoiceId: invoice.id, status: 'PAID' })}
                          className="text-xs text-green-600 dark:text-green-400 hover:underline mt-1"
                        >
                          Marcar como pagada →
                        </button>
                      )}
                    </div>
                    {invoice.status === 'DRAFT' && (
                      <button
                        onClick={() => setConfirmDelete({ id: invoice.id, number: invoice.number })}
                        className="p-2 text-gray-400 hover:text-red-500 dark:hover:text-red-400 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition flex-shrink-0"
                        title="Eliminar factura"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
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
