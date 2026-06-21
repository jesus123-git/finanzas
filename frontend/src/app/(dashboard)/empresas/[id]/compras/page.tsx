'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { api } from '@/lib/axios';
import Link from 'next/link';
import { ArrowLeft, Plus, X, ShoppingCart, Trash2, CheckCircle2, Banknote } from 'lucide-react';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

interface Supplier { id: string; name: string }
interface Product { id: string; name: string; price: number; taxRate: number }
interface Purchase {
  id: string; number: string; status: string;
  dueDate?: string; notes?: string;
  subtotal: number; tax: number; total: number;
  supplier?: { id: string; name: string };
  _count?: { items: number };
  createdAt: string;
}

interface FormItem { productId?: string; description: string; quantity: number; unitPrice: number; taxRate: number }
interface FormData { supplierId?: string; dueDate?: string; notes?: string; items: FormItem[] }

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  DRAFT:     { label: 'Borrador',   color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
  RECEIVED:  { label: 'Recibida',   color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400' },
  PAID:      { label: 'Pagada',     color: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' },
  CANCELLED: { label: 'Cancelada',  color: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400' },
};

function formatCOP(n: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
}
function formatDate(d: string) {
  return new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

const inputCls = 'w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition text-sm';
const inputSmCls = 'w-full px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition';

export default function PurchasesPage() {
  const { id: businessId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; number: string } | null>(null);

  const { data: purchases, isLoading } = useQuery({
    queryKey: ['purchases', businessId],
    queryFn: async () => (await api.get<Purchase[]>(`/businesses/${businessId}/purchases`)).data,
    enabled: !!businessId,
  });

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers', businessId],
    queryFn: async () => (await api.get<Supplier[]>(`/businesses/${businessId}/suppliers`)).data,
    enabled: !!businessId,
  });

  const { data: products } = useQuery({
    queryKey: ['products', businessId],
    queryFn: async () => (await api.get<Product[]>(`/businesses/${businessId}/products`)).data,
    enabled: !!businessId,
  });

  const { register, handleSubmit, control, watch, reset, setValue, formState: { isSubmitting } } = useForm<FormData>({
    defaultValues: { items: [{ description: '', quantity: 1, unitPrice: 0, taxRate: 19 }] },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const watchedItems = watch('items');

  const subtotal = watchedItems?.reduce((s, i) => s + (Number(i.quantity) * Number(i.unitPrice)), 0) ?? 0;
  const tax = watchedItems?.reduce((s, i) => s + (Number(i.quantity) * Number(i.unitPrice) * Number(i.taxRate) / 100), 0) ?? 0;

  const onProductSelect = (index: number, productId: string) => {
    const p = products?.find(p => p.id === productId);
    if (p) {
      setValue(`items.${index}.description`, p.name);
      setValue(`items.${index}.taxRate`, Number(p.taxRate));
      // Para compras, el precio puede diferir del precio de venta
    }
  };

  const createMutation = useMutation({
    mutationFn: (data: FormData) => api.post(`/businesses/${businessId}/purchases`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['purchases', businessId] }); setShowForm(false); reset(); },
  });

  const statusMutation = useMutation({
    mutationFn: ({ purchaseId, status }: { purchaseId: string; status: string }) =>
      api.patch(`/businesses/${businessId}/purchases/${purchaseId}/status`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['purchases', businessId] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/businesses/${businessId}/purchases/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchases', businessId] });
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
            <span className="font-semibold text-gray-900 dark:text-white">Órdenes de Compra</span>
          </div>
          <ThemeToggle />
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Órdenes de Compra</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">{purchases?.length ?? 0} registradas</p>
          </div>
          <div className="flex gap-2">
            <Link href={`/empresas/${businessId}/suppliers`} className="flex items-center gap-2 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 px-4 py-2.5 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition text-sm">
              Proveedores
            </Link>
            <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg font-medium transition text-sm">
              <Plus size={18} /> Nueva orden
            </button>
          </div>
        </div>

        {/* Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-2xl p-6 shadow-xl border border-gray-100 dark:border-gray-800 my-8">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Nueva orden de compra</h2>
                <button onClick={() => { setShowForm(false); reset(); }} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X size={20} /></button>
              </div>

              <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Proveedor</label>
                    <select {...register('supplierId')} className={inputCls}>
                      <option value="">Sin proveedor</option>
                      {suppliers?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Fecha límite de pago</label>
                    <input {...register('dueDate')} type="date" className={inputCls} />
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
                        <select onChange={(e) => onProductSelect(index, e.target.value)} className={`${inputSmCls} text-gray-400 dark:text-gray-500`}>
                          <option value="">— Vincular a producto del catálogo (opcional) —</option>
                          {products?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        <div className="grid grid-cols-12 gap-2 items-start">
                          <div className="col-span-5">
                            <input {...register(`items.${index}.description`, { required: true })} placeholder="Descripción" className={inputSmCls} />
                          </div>
                          <div className="col-span-2">
                            <input {...register(`items.${index}.quantity`)} type="number" placeholder="Cant." min="0.001" step="0.001" className={inputSmCls} />
                          </div>
                          <div className="col-span-2">
                            <input {...register(`items.${index}.unitPrice`)} type="number" placeholder="Costo" min="0" className={inputSmCls} />
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
                              <button type="button" onClick={() => remove(index)} className="text-red-400 hover:text-red-600"><Trash2 size={16} /></button>
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
                  <div className="flex justify-between font-bold text-gray-900 dark:text-white text-base pt-1 border-t border-gray-200 dark:border-gray-700"><span>Total</span><span>{formatCOP(subtotal + tax)}</span></div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notas</label>
                  <textarea {...register('notes')} rows={2} placeholder="Observaciones, condiciones de entrega..." className={`${inputCls} resize-none`} />
                </div>

                <div className="flex gap-3">
                  <button type="button" onClick={() => { setShowForm(false); reset(); }} className="flex-1 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 py-2.5 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition">Cancelar</button>
                  <button type="submit" disabled={isSubmitting} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-2.5 rounded-lg font-medium transition">
                    {isSubmitting ? 'Creando...' : 'Crear orden'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Confirmación de eliminación */}
        <ConfirmDialog
          open={!!confirmDelete}
          title="Eliminar orden de compra"
          message={`¿Eliminar la orden ${confirmDelete?.number}? Esta acción no se puede deshacer.`}
          onConfirm={() => confirmDelete && deleteMutation.mutate(confirmDelete.id)}
          onCancel={() => setConfirmDelete(null)}
        />

        {/* Lista */}
        {isLoading ? (
          <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-5 animate-pulse h-24" />)}</div>
        ) : purchases?.length === 0 ? (
          <div className="text-center py-16">
            <ShoppingCart size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
            <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">No hay órdenes de compra</h3>
            <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition">
              <Plus size={18} /> Crear primera orden
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {purchases?.map((p) => {
              const st = STATUS_CONFIG[p.status];
              const isOverdue = p.dueDate && new Date(p.dueDate) < new Date() && !['PAID', 'CANCELLED'].includes(p.status);
              return (
                <div key={p.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 px-5 py-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <span className="font-semibold text-gray-900 dark:text-white">{p.number}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.color}`}>{st.label}</span>
                        {isOverdue && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Vencida</span>}
                      </div>
                      {p.supplier && <p className="text-sm text-gray-500 dark:text-gray-400">{p.supplier.name}</p>}
                      <div className="flex gap-3 text-xs text-gray-400 dark:text-gray-500 mt-1">
                        <span>{formatDate(p.createdAt)}</span>
                        {p.dueDate && <span>Pago: {formatDate(p.dueDate)}</span>}
                        <span>{p._count?.items ?? 0} ítems</span>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0 ml-4">
                      <p className="font-bold text-gray-900 dark:text-white text-lg">{formatCOP(Number(p.total))}</p>
                      <div className="flex flex-col items-end gap-1 mt-2">
                        {p.status === 'DRAFT' && (
                          <button onClick={() => statusMutation.mutate({ purchaseId: p.id, status: 'RECEIVED' })} className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline">
                            <CheckCircle2 size={13} /> Marcar recibida
                          </button>
                        )}
                        {p.status === 'RECEIVED' && (
                          <button onClick={() => statusMutation.mutate({ purchaseId: p.id, status: 'PAID' })} className="flex items-center gap-1 text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg transition font-medium">
                            <Banknote size={13} /> Marcar pagada
                          </button>
                        )}
                        {!['PAID', 'CANCELLED'].includes(p.status) && (
                          <>
                            <button onClick={() => statusMutation.mutate({ purchaseId: p.id, status: 'CANCELLED' })} className="text-xs text-gray-400 hover:text-red-500 dark:hover:text-red-400">
                              Cancelar
                            </button>
                            <button onClick={() => setConfirmDelete({ id: p.id, number: p.number })} className="text-xs text-gray-400 hover:text-red-500 dark:hover:text-red-400">
                              Eliminar
                            </button>
                          </>
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
