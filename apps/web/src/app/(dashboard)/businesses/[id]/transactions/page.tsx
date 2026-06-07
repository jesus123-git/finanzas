'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import { Transaction } from '@/types';
import Link from 'next/link';
import { ArrowLeft, Plus, X, TrendingUp, TrendingDown, Trash2 } from 'lucide-react';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

const schema = z.object({
  type: z.enum(['INCOME', 'EXPENSE']),
  amount: z.coerce.number().positive('Debe ser mayor a 0'),
  description: z.string().min(1, 'Requerido'),
  date: z.string().min(1, 'Requerido'),
  category: z.string().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const inputCls =
  'w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition';
const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

function formatCOP(amount: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const INCOME_CATEGORIES = ['Ventas', 'Servicios', 'Comisiones', 'Intereses', 'Otros ingresos'];
const EXPENSE_CATEGORIES = [
  'Nómina', 'Arriendo', 'Servicios públicos', 'Insumos', 'Marketing',
  'Transporte', 'Impuestos', 'Mantenimiento', 'Otros gastos',
];

export default function TransactionsPage() {
  const { id: businessId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [filterType, setFilterType] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');

  const { data: transactions, isLoading } = useQuery({
    queryKey: ['transactions', businessId, filterType],
    queryFn: async () => {
      const params = filterType !== 'ALL' ? `?type=${filterType}` : '';
      return (await api.get<Transaction[]>(`/businesses/${businessId}/transactions${params}`)).data;
    },
    enabled: !!businessId,
  });

  const { data: summary } = useQuery({
    queryKey: ['transactions-summary', businessId],
    queryFn: async () =>
      (await api.get<{ income: number; expenses: number; profit: number }>(
        `/businesses/${businessId}/transactions/summary`,
      )).data,
    enabled: !!businessId,
  });

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: 'INCOME',
      date: new Date().toISOString().split('T')[0],
    },
  });

  const selectedType = watch('type');

  const createMutation = useMutation({
    mutationFn: (data: FormData) =>
      api.post(`/businesses/${businessId}/transactions`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions', businessId] });
      queryClient.invalidateQueries({ queryKey: ['transactions-summary', businessId] });
      queryClient.invalidateQueries({ queryKey: ['business-dashboard', businessId] });
      reset({ type: 'INCOME', date: new Date().toISOString().split('T')[0] });
      setShowForm(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (txId: string) =>
      api.delete(`/businesses/${businessId}/transactions/${txId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions', businessId] });
      queryClient.invalidateQueries({ queryKey: ['transactions-summary', businessId] });
      queryClient.invalidateQueries({ queryKey: ['business-dashboard', businessId] });
    },
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Navbar */}
      <nav className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href={`/businesses/${businessId}`}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition"
            >
              <ArrowLeft size={20} />
            </Link>
            <span className="font-semibold text-gray-900 dark:text-white">Transacciones</span>
          </div>
          <ThemeToggle />
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Resumen del mes */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-5">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp size={16} className="text-green-500" />
              <span className="text-sm text-gray-500 dark:text-gray-400">Ingresos</span>
            </div>
            <p className="text-xl font-bold text-green-600 dark:text-green-400">
              {formatCOP(summary?.income ?? 0)}
            </p>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-5">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown size={16} className="text-red-500" />
              <span className="text-sm text-gray-500 dark:text-gray-400">Gastos</span>
            </div>
            <p className="text-xl font-bold text-red-500 dark:text-red-400">
              {formatCOP(summary?.expenses ?? 0)}
            </p>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-5">
            <span className="text-sm text-gray-500 dark:text-gray-400 block mb-2">Utilidad neta</span>
            <p
              className={`text-xl font-bold ${
                (summary?.profit ?? 0) >= 0
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-red-500 dark:text-red-400'
              }`}
            >
              {formatCOP(summary?.profit ?? 0)}
            </p>
          </div>
        </div>

        {/* Header + filtros */}
        <div className="flex items-center justify-between">
          <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            {(['ALL', 'INCOME', 'EXPENSE'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
                  filterType === t
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                {t === 'ALL' ? 'Todos' : t === 'INCOME' ? 'Ingresos' : 'Gastos'}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg font-medium transition"
          >
            <Plus size={18} />
            Registrar
          </button>
        </div>

        {/* Modal nueva transacción */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md p-6 shadow-xl border border-gray-100 dark:border-gray-800">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  Nueva transacción
                </h2>
                <button
                  onClick={() => setShowForm(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
                {/* Tipo */}
                <div className="grid grid-cols-2 gap-2">
                  <label
                    className={`flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 cursor-pointer transition font-medium text-sm ${
                      selectedType === 'INCOME'
                        ? 'border-green-500 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                        : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300'
                    }`}
                  >
                    <input {...register('type')} type="radio" value="INCOME" className="hidden" />
                    <TrendingUp size={16} />
                    Ingreso
                  </label>
                  <label
                    className={`flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 cursor-pointer transition font-medium text-sm ${
                      selectedType === 'EXPENSE'
                        ? 'border-red-500 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                        : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300'
                    }`}
                  >
                    <input {...register('type')} type="radio" value="EXPENSE" className="hidden" />
                    <TrendingDown size={16} />
                    Gasto
                  </label>
                </div>

                {/* Monto */}
                <div>
                  <label className={labelCls}>Monto (COP)</label>
                  <input
                    {...register('amount')}
                    type="number"
                    placeholder="0"
                    min="0"
                    className={inputCls}
                  />
                  {errors.amount && (
                    <p className="mt-1 text-sm text-red-500">{errors.amount.message}</p>
                  )}
                </div>

                {/* Descripción */}
                <div>
                  <label className={labelCls}>Descripción</label>
                  <input
                    {...register('description')}
                    placeholder="Ej: Pago a proveedor XYZ"
                    className={inputCls}
                  />
                  {errors.description && (
                    <p className="mt-1 text-sm text-red-500">{errors.description.message}</p>
                  )}
                </div>

                {/* Categoría y Fecha */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Categoría</label>
                    <select {...register('category')} className={inputCls}>
                      <option value="">Sin categoría</option>
                      {(selectedType === 'INCOME' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map(
                        (c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ),
                      )}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Fecha</label>
                    <input {...register('date')} type="date" className={inputCls} />
                    {errors.date && (
                      <p className="mt-1 text-sm text-red-500">{errors.date.message}</p>
                    )}
                  </div>
                </div>

                {/* Notas */}
                <div>
                  <label className={labelCls}>Notas (opcional)</label>
                  <textarea
                    {...register('notes')}
                    rows={2}
                    placeholder="Detalles adicionales..."
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
                    {isSubmitting ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Lista de transacciones */}
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-4 animate-pulse h-16"
              />
            ))}
          </div>
        ) : transactions?.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-400 dark:text-gray-500 mb-4">No hay transacciones aún</p>
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition"
            >
              <Plus size={18} /> Registrar primera transacción
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {transactions?.map((tx) => (
              <div
                key={tx.id}
                className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 px-5 py-4 flex items-center justify-between group"
              >
                <div className="flex items-center gap-4">
                  {/* Indicador de tipo */}
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      tx.type === 'INCOME'
                        ? 'bg-green-50 dark:bg-green-900/30'
                        : 'bg-red-50 dark:bg-red-900/30'
                    }`}
                  >
                    {tx.type === 'INCOME' ? (
                      <TrendingUp size={16} className="text-green-600 dark:text-green-400" />
                    ) : (
                      <TrendingDown size={16} className="text-red-500 dark:text-red-400" />
                    )}
                  </div>

                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{tx.description}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      {tx.categoryLabel && (
                        <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800 px-2 py-0.5 rounded-full">
                          {tx.categoryLabel}
                        </span>
                      )}
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {formatDate(tx.date)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <span
                    className={`font-bold text-base ${
                      tx.type === 'INCOME'
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-500 dark:text-red-400'
                    }`}
                  >
                    {tx.type === 'INCOME' ? '+' : '-'}
                    {formatCOP(Number(tx.amount))}
                  </span>
                  <button
                    onClick={() => {
                      if (confirm('¿Eliminar esta transacción?')) {
                        deleteMutation.mutate(tx.id);
                      }
                    }}
                    className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 dark:text-gray-600 dark:hover:text-red-400 transition"
                  >
                    <Trash2 size={16} />
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
