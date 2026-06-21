'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/axios';
import Link from 'next/link';
import { ArrowLeft, Plus, X, Package, Wrench, AlertTriangle, Edit2 } from 'lucide-react';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { MoneyInput } from '@/components/ui/MoneyInput';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Product {
  id: string;
  name: string;
  description?: string;
  type: 'PRODUCT' | 'SERVICE';
  sku?: string;
  price: number;
  cost?: number;
  taxRate: number;
  unit: string;
  trackInventory: boolean;
  stock: number;
  minStock?: number;
  isActive: boolean;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  name: z.string().min(1, 'Requerido'),
  description: z.string().optional(),
  type: z.enum(['PRODUCT', 'SERVICE']),
  sku: z.string().optional(),
  price: z.coerce.number().min(0, 'Debe ser mayor a 0'),
  cost: z.coerce.number().min(0).optional(),
  taxRate: z.coerce.number().min(0).max(100),
  unit: z.string().optional(),
  trackInventory: z.boolean().optional(),
  stock: z.coerce.number().min(0).optional(),
  minStock: z.coerce.number().min(0).optional(),
});

type FormData = z.infer<typeof schema>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCOP(amount: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(amount);
}

const UNITS = ['unidad', 'kg', 'g', 'litro', 'metro', 'caja', 'hora', 'mes', 'servicio'];

const inputCls =
  'w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition';
const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

// ─── Componente principal ─────────────────────────────────────────────────────

export default function ProductsPage() {
  const { id: businessId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [filterType, setFilterType] = useState<'ALL' | 'PRODUCT' | 'SERVICE'>('ALL');
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);

  const { data: business } = useQuery({
    queryKey: ['business', businessId],
    queryFn: async () => (await api.get<{ currency?: string }>(`/businesses/${businessId}`)).data,
    enabled: !!businessId,
  });
  const currency = business?.currency ?? 'COP';

  const { data: products, isLoading } = useQuery({
    queryKey: ['products', businessId, filterType],
    queryFn: async () => {
      const params = filterType !== 'ALL' ? `?type=${filterType}` : '';
      return (await api.get<Product[]>(`/businesses/${businessId}/products${params}`)).data;
    },
    enabled: !!businessId,
  });

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { type: 'PRODUCT', taxRate: 19, unit: 'unidad', trackInventory: false },
  });

  const selectedType = watch('type');
  const trackInventory = watch('trackInventory');

  const openCreate = () => {
    setEditProduct(null);
    reset({ type: 'PRODUCT', taxRate: 19, unit: 'unidad', trackInventory: false });
    setShowForm(true);
  };

  const openEdit = (p: Product) => {
    setEditProduct(p);
    reset({
      name: p.name,
      description: p.description,
      type: p.type,
      sku: p.sku,
      price: p.price,
      cost: p.cost,
      taxRate: p.taxRate,
      unit: p.unit,
      trackInventory: p.trackInventory,
      stock: p.stock,
      minStock: p.minStock,
    });
    setShowForm(true);
  };

  const createMutation = useMutation({
    mutationFn: (data: FormData) => api.post(`/businesses/${businessId}/products`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', businessId] });
      setShowForm(false);
      reset();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: FormData) =>
      api.patch(`/businesses/${businessId}/products/${editProduct!.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', businessId] });
      setShowForm(false);
      setEditProduct(null);
      reset();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (productId: string) =>
      api.delete(`/businesses/${businessId}/products/${productId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', businessId] });
      setConfirmDelete(null);
    },
  });

  const onSubmit = (data: FormData) => {
    if (editProduct) updateMutation.mutate(data);
    else createMutation.mutate(data);
  };

  const lowStock = (p: Product) =>
    p.trackInventory && p.minStock != null && Number(p.stock) <= Number(p.minStock);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Navbar */}
      <nav className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href={`/empresas/${businessId}`}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition"
            >
              <ArrowLeft size={20} />
            </Link>
            <span className="font-semibold text-gray-900 dark:text-white">
              Productos y servicios
            </span>
          </div>
          <ThemeToggle />
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Header + filtros */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            {(['ALL', 'PRODUCT', 'SERVICE'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
                  filterType === t
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                {t === 'ALL' ? 'Todos' : t === 'PRODUCT' ? 'Productos' : 'Servicios'}
              </button>
            ))}
          </div>

          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg font-medium transition"
          >
            <Plus size={18} />
            Nuevo
          </button>
        </div>

        {/* Modal crear/editar */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-lg p-6 shadow-xl border border-gray-100 dark:border-gray-800 my-8">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  {editProduct ? 'Editar' : 'Nuevo'} producto o servicio
                </h2>
                <button
                  onClick={() => setShowForm(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                {/* Tipo */}
                <div className="grid grid-cols-2 gap-2">
                  <label
                    className={`flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 cursor-pointer transition font-medium text-sm ${
                      selectedType === 'PRODUCT'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                        : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    <input {...register('type')} type="radio" value="PRODUCT" className="hidden" onChange={() => setValue('type', 'PRODUCT')} />
                    <Package size={16} /> Producto
                  </label>
                  <label
                    className={`flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 cursor-pointer transition font-medium text-sm ${
                      selectedType === 'SERVICE'
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                        : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    <input {...register('type')} type="radio" value="SERVICE" className="hidden" onChange={() => setValue('type', 'SERVICE')} />
                    <Wrench size={16} /> Servicio
                  </label>
                </div>

                {/* Nombre */}
                <div>
                  <label className={labelCls}>Nombre <span className="text-red-500">*</span></label>
                  <input {...register('name')} placeholder="Ej: Camiseta talla M" className={inputCls} />
                  {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name.message}</p>}
                </div>

                {/* SKU + Unidad */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>SKU / Código</label>
                    <input {...register('sku')} placeholder="CAM-M-001" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Unidad de medida</label>
                    <select {...register('unit')} className={inputCls}>
                      {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                </div>

                {/* Precio + Costo */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Precio de venta ({currency}) <span className="text-red-500">*</span></label>
                    <MoneyInput
                      value={watch('price')}
                      onChange={n => setValue('price', n, { shouldValidate: true })}
                      className={inputCls}
                    />
                    {errors.price && <p className="mt-1 text-sm text-red-500">{errors.price.message}</p>}
                  </div>
                  <div>
                    <label className={labelCls}>Costo ({currency})</label>
                    <MoneyInput
                      value={watch('cost')}
                      onChange={n => setValue('cost', n, { shouldValidate: true })}
                      className={inputCls}
                    />
                  </div>
                </div>

                {/* IVA */}
                <div>
                  <label className={labelCls}>IVA</label>
                  <select {...register('taxRate')} className={inputCls}>
                    <option value={0}>0% — Excluido</option>
                    <option value={5}>5% — Tarifa reducida</option>
                    <option value={19}>19% — Tarifa general</option>
                  </select>
                </div>

                {/* Inventario — solo para PRODUCT */}
                {selectedType === 'PRODUCT' && (
                  <div className="border border-gray-100 dark:border-gray-800 rounded-xl p-4 space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        {...register('trackInventory')}
                        type="checkbox"
                        className="w-4 h-4 rounded accent-blue-600"
                      />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Controlar inventario
                      </span>
                    </label>

                    {trackInventory && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={labelCls}>Stock actual</label>
                          <input {...register('stock')} type="number" min="0" placeholder="0" className={inputCls} />
                        </div>
                        <div>
                          <label className={labelCls}>Stock mínimo (alerta)</label>
                          <input {...register('minStock')} type="number" min="0" placeholder="5" className={inputCls} />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Descripción */}
                <div>
                  <label className={labelCls}>Descripción</label>
                  <textarea
                    {...register('description')}
                    rows={2}
                    placeholder="Descripción opcional del producto..."
                    className={`${inputCls} resize-none`}
                  />
                </div>

                <div className="flex gap-3 pt-1">
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
                    {isSubmitting ? 'Guardando...' : editProduct ? 'Actualizar' : 'Crear'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Confirmación de eliminación */}
        <ConfirmDialog
          open={!!confirmDelete}
          title="Desactivar producto"
          message={`¿Desactivar "${confirmDelete?.name}"? Dejará de aparecer en el catálogo pero el historial se conserva.`}
          confirmLabel="Desactivar"
          onConfirm={() => confirmDelete && deleteMutation.mutate(confirmDelete.id)}
          onCancel={() => setConfirmDelete(null)}
        />

        {/* Lista */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-5 animate-pulse h-20" />
            ))}
          </div>
        ) : products?.length === 0 ? (
          <div className="text-center py-16">
            <Package size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
            <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
              No hay productos aún
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              Crea tu catálogo para agilizar la creación de facturas
            </p>
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition"
            >
              <Plus size={18} /> Crear primer producto
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {products?.map((product) => (
              <div
                key={product.id}
                className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 px-5 py-4 flex items-center justify-between group"
              >
                <div className="flex items-center gap-4">
                  {/* Ícono tipo */}
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      product.type === 'PRODUCT'
                        ? 'bg-blue-50 dark:bg-blue-900/30'
                        : 'bg-purple-50 dark:bg-purple-900/30'
                    }`}
                  >
                    {product.type === 'PRODUCT' ? (
                      <Package size={18} className="text-blue-600 dark:text-blue-400" />
                    ) : (
                      <Wrench size={18} className="text-purple-600 dark:text-purple-400" />
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900 dark:text-white">{product.name}</p>
                      {product.sku && (
                        <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800 px-2 py-0.5 rounded-full">
                          {product.sku}
                        </span>
                      )}
                      {lowStock(product) && (
                        <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded-full">
                          <AlertTriangle size={11} /> Stock bajo
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {formatCOP(Number(product.price))}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        IVA {Number(product.taxRate)}%
                      </span>
                      {product.trackInventory && (
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          Stock: {Number(product.stock)} {product.unit}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Acciones */}
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition">
                  <button
                    onClick={() => openEdit(product)}
                    className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => setConfirmDelete({ id: product.id, name: product.name })}
                    className="p-2 text-gray-400 hover:text-red-500 dark:hover:text-red-400 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
