'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { api } from '@/lib/axios';
import Link from 'next/link';
import { ArrowLeft, Plus, X, Tag, Star, Users, ChevronDown, ChevronUp, Edit2, Trash2 } from 'lucide-react';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { PlanGate } from '@/components/ui/PlanGate';

interface Product { id: string; name: string; price: number; unit: string; sku?: string }
interface PriceListItem { productId: string; price: number; product: Product }
interface PriceList {
  id: string; name: string; isDefault: boolean;
  items: PriceListItem[];
  _count: { customers: number };
}

function formatCOP(n: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
}

const inputCls = 'w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition';
const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

export default function PriceListsPage() {
  const { id: businessId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editingPrices, setEditingPrices] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);

  // ─── Queries ────────────────────────────────────────────────────────────────
  const { data: business } = useQuery({
    queryKey: ['business', businessId],
    queryFn: async () => (await api.get(`/businesses/${businessId}`)).data,
  });

  const { data: priceLists, isLoading } = useQuery({
    queryKey: ['price-lists', businessId],
    queryFn: async () => (await api.get<PriceList[]>(`/businesses/${businessId}/price-lists`)).data,
    enabled: !!businessId,
  });

  const { data: products } = useQuery({
    queryKey: ['products', businessId, 'ALL'],
    queryFn: async () => (await api.get<Product[]>(`/businesses/${businessId}/products`)).data,
    enabled: !!businessId,
  });

  // ─── Mutations ──────────────────────────────────────────────────────────────
  const toggleMutation = useMutation({
    mutationFn: (enabled: boolean) =>
      api.patch(`/businesses/${businessId}/price-lists/toggle`, { enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business', businessId] });
      queryClient.invalidateQueries({ queryKey: ['price-lists', businessId] });
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; isDefault: boolean }) =>
      api.post(`/businesses/${businessId}/price-lists`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['price-lists', businessId] });
      setShowCreate(false);
      reset();
    },
  });

  const upsertItemsMutation = useMutation({
    mutationFn: ({ plId, items }: { plId: string; items: { productId: string; price: number }[] }) =>
      api.patch(`/businesses/${businessId}/price-lists/${plId}/items`, { items }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['price-lists', businessId] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (plId: string) => api.delete(`/businesses/${businessId}/price-lists/${plId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['price-lists', businessId] });
      setConfirmDelete(null);
    },
  });

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<{ name: string; isDefault: boolean }>({
    defaultValues: { isDefault: false },
  });

  const onSavePrices = (plId: string, existingItems: PriceListItem[]) => {
    const items = (products ?? []).map((p) => {
      const key = `${plId}-${p.id}`;
      const raw = editingPrices[key];
      const price = raw !== undefined ? Number(raw) : (existingItems.find(i => i.productId === p.id)?.price ?? Number(p.price));
      return { productId: p.id, price };
    }).filter(i => i.price > 0);

    upsertItemsMutation.mutate({ plId, items });
  };

  const getPriceValue = (plId: string, productId: string, items: PriceListItem[], defaultPrice: number) => {
    const key = `${plId}-${productId}`;
    if (editingPrices[key] !== undefined) return editingPrices[key];
    const item = items.find(i => i.productId === productId);
    return item ? String(Number(item.price)) : String(defaultPrice);
  };

  const usePriceLists = business?.usePriceLists ?? false;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <nav className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href={`/empresas/${businessId}`} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition">
              <ArrowLeft size={20} />
            </Link>
            <span className="font-semibold text-gray-900 dark:text-white">Listas de precios</span>
          </div>
          <ThemeToggle />
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <PlanGate
          requiredPlan="PRO"
          featureName="Listas de precios — Nomi PRO"
          featureDescription="Crea precios diferenciados por tipo de cliente: mayorista, minorista, VIP. Disponible en Nomi PRO y Nomi Empresa."
        >
        {/* Toggle activar/desactivar */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-5 flex items-center justify-between">
          <div>
            <p className="font-semibold text-gray-900 dark:text-white">Listas de precios</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Crea precios diferenciados por tipo de cliente (mayorista, minorista, especial)
            </p>
          </div>
          <button
            onClick={() => toggleMutation.mutate(!usePriceLists)}
            className={`relative inline-flex w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none flex-shrink-0 ${usePriceLists ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}
          >
            <span className={`inline-block w-5 h-5 bg-white rounded-full shadow transform transition-transform duration-200 mt-0.5 ${usePriceLists ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>

        {/* Contenido — solo visible si está activado */}
        {usePriceLists && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {priceLists?.length ?? 0} lista(s) configurada(s)
              </p>
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg font-medium transition text-sm"
              >
                <Plus size={16} /> Nueva lista
              </button>
            </div>

            {/* Modal crear lista */}
            {showCreate && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-sm p-6 shadow-xl border border-gray-100 dark:border-gray-800">
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">Nueva lista</h2>
                    <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                      <X size={20} />
                    </button>
                  </div>
                  <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
                    <div>
                      <label className={labelCls}>Nombre de la lista</label>
                      <input {...register('name', { required: true })} placeholder="Ej: Mayorista, VIP, Distribuidores" className={inputCls} />
                    </div>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input {...register('isDefault')} type="checkbox" className="w-4 h-4 rounded accent-blue-600" />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Usar como lista por defecto</span>
                    </label>
                    <div className="flex gap-3 pt-1">
                      <button type="button" onClick={() => setShowCreate(false)} className="flex-1 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 py-2.5 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                        Cancelar
                      </button>
                      <button type="submit" disabled={isSubmitting} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-medium transition">
                        Crear
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Confirmación de eliminación */}
            <ConfirmDialog
              open={!!confirmDelete}
              title="Eliminar lista de precios"
              message={`¿Eliminar la lista "${confirmDelete?.name}"? Los precios especiales de esta lista se perderán.`}
              onConfirm={() => confirmDelete && deleteMutation.mutate(confirmDelete.id)}
              onCancel={() => setConfirmDelete(null)}
            />

            {/* Lista de price lists */}
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2].map(i => <div key={i} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-5 animate-pulse h-20" />)}
              </div>
            ) : priceLists?.length === 0 ? (
              <div className="text-center py-12">
                <Tag size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                <p className="text-gray-500 dark:text-gray-400">Crea tu primera lista de precios</p>
              </div>
            ) : (
              <div className="space-y-3">
                {priceLists?.map((pl) => (
                  <div key={pl.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
                    {/* Cabecera */}
                    <div className="flex items-center justify-between px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-blue-50 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                          <Tag size={16} className="text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-gray-900 dark:text-white">{pl.name}</p>
                            {pl.isDefault && (
                              <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded-full">
                                <Star size={10} /> Default
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 flex items-center gap-2">
                            <span>{pl.items.length} producto(s)</span>
                            <span className="flex items-center gap-1"><Users size={11} /> {pl._count.customers} cliente(s)</span>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setConfirmDelete({ id: pl.id, name: pl.name })}
                          className="p-2 text-gray-400 hover:text-red-500 dark:hover:text-red-400 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                        >
                          <Trash2 size={15} />
                        </button>
                        <button
                          onClick={() => setExpandedId(expandedId === pl.id ? null : pl.id)}
                          className="p-2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                        >
                          {expandedId === pl.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </button>
                      </div>
                    </div>

                    {/* Tabla de precios — expandible */}
                    {expandedId === pl.id && (
                      <div className="border-t border-gray-100 dark:border-gray-800 px-5 py-4">
                        {(products?.length ?? 0) === 0 ? (
                          <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">
                            Primero crea productos en el catálogo
                          </p>
                        ) : (
                          <>
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3">
                              Edita los precios para esta lista. Precio base del catálogo en gris.
                            </p>
                            <div className="space-y-2">
                              {products?.map((p) => (
                                <div key={p.id} className="flex items-center justify-between gap-4">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{p.name}</p>
                                    <p className="text-xs text-gray-400 dark:text-gray-500">
                                      Base: {formatCOP(Number(p.price))} / {p.unit}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    <span className="text-sm text-gray-400 dark:text-gray-500">$</span>
                                    <input
                                      type="number"
                                      min="0"
                                      value={getPriceValue(pl.id, p.id, pl.items, Number(p.price))}
                                      onChange={(e) =>
                                        setEditingPrices((prev) => ({ ...prev, [`${pl.id}-${p.id}`]: e.target.value }))
                                      }
                                      className="w-32 px-3 py-1.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                            <button
                              onClick={() => onSavePrices(pl.id, pl.items)}
                              disabled={upsertItemsMutation.isPending}
                              className="mt-4 w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-2 rounded-lg text-sm font-medium transition"
                            >
                              {upsertItemsMutation.isPending ? 'Guardando...' : 'Guardar precios'}
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        </PlanGate>
      </main>
    </div>
  );
}
