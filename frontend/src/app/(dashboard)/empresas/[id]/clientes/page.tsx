'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/axios';
import Link from 'next/link';
import { ArrowLeft, Plus, X, Users, Mail, Phone, Trash2 } from 'lucide-react';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

const schema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres'),
  nit: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface Customer {
  id: string;
  name: string;
  nit?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
}

const inputCls = 'w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition';
const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

export default function CustomersPage() {
  const { id: businessId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);

  const { data: customers, isLoading } = useQuery({
    queryKey: ['customers', businessId],
    queryFn: async () => (await api.get<Customer[]>(`/businesses/${businessId}/customers`)).data,
    enabled: !!businessId,
  });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const createMutation = useMutation({
    mutationFn: (data: FormData) => api.post(`/businesses/${businessId}/customers`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers', businessId] });
      queryClient.invalidateQueries({ queryKey: ['business', businessId] });
      reset();
      setShowForm(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/businesses/${businessId}/customers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers', businessId] });
      setConfirmDelete(null);
    },
  });

  const onSubmit = (data: FormData) => createMutation.mutate(data);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Navbar */}
      <nav className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href={`/empresas/${businessId}`} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition">
              <ArrowLeft size={20} />
            </Link>
            <span className="font-semibold text-gray-900 dark:text-white">Clientes</span>
          </div>
          <ThemeToggle />
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Clientes</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">{customers?.length ?? 0} registrados</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg font-medium transition"
          >
            <Plus size={18} />
            Nuevo cliente
          </button>
        </div>

        {/* Formulario modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-lg p-6 shadow-xl border border-gray-100 dark:border-gray-800">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Nuevo cliente</h2>
                <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <label className={labelCls}>Nombre <span className="text-red-500">*</span></label>
                  <input {...register('name')} placeholder="Empresa o persona" className={inputCls} />
                  {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name.message}</p>}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>NIT / Cédula</label>
                    <input {...register('nit')} placeholder="900123456-7" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Teléfono</label>
                    <input {...register('phone')} placeholder="+57 300..." className={inputCls} />
                  </div>
                </div>

                <div>
                  <label className={labelCls}>Email</label>
                  <input {...register('email')} type="email" placeholder="cliente@email.com" className={inputCls} />
                  {errors.email && <p className="mt-1 text-sm text-red-500">{errors.email.message}</p>}
                </div>

                <div>
                  <label className={labelCls}>Notas</label>
                  <textarea {...register('notes')} placeholder="Paga a 30 días..." rows={2} className={`${inputCls} resize-none`} />
                </div>

                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => setShowForm(false)} className="flex-1 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 py-2.5 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                    Cancelar
                  </button>
                  <button type="submit" disabled={isSubmitting} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-2.5 rounded-lg font-medium transition">
                    {isSubmitting ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Confirmación de eliminación */}
        <ConfirmDialog
          open={!!confirmDelete}
          title="Eliminar cliente"
          message={`¿Eliminar a "${confirmDelete?.name}"? Se eliminará del directorio pero las facturas existentes se conservarán.`}
          onConfirm={() => confirmDelete && deleteMutation.mutate(confirmDelete.id)}
          onCancel={() => setConfirmDelete(null)}
        />

        {/* Lista de clientes */}
        {isLoading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-5 animate-pulse h-20" />)}
          </div>
        ) : customers?.length === 0 ? (
          <div className="text-center py-16">
            <Users size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
            <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">No tienes clientes aún</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">Agrega tu primer cliente para empezar a facturar</p>
            <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition">
              <Plus size={18} /> Nuevo cliente
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {customers?.map((customer) => (
              <div key={customer.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-5 flex items-center justify-between group">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">{customer.name}</h3>
                  <div className="flex items-center gap-4 mt-1">
                    {customer.nit && <span className="text-sm text-gray-400 dark:text-gray-500">NIT: {customer.nit}</span>}
                    {customer.email && (
                      <span className="flex items-center gap-1 text-sm text-gray-400 dark:text-gray-500">
                        <Mail size={13} /> {customer.email}
                      </span>
                    )}
                    {customer.phone && (
                      <span className="flex items-center gap-1 text-sm text-gray-400 dark:text-gray-500">
                        <Phone size={13} /> {customer.phone}
                      </span>
                    )}
                  </div>
                  {customer.notes && <p className="text-sm text-gray-400 dark:text-gray-500 mt-1 italic">{customer.notes}</p>}
                </div>
                <button
                  onClick={() => setConfirmDelete({ id: customer.id, name: customer.name })}
                  className="p-2 text-gray-400 hover:text-red-500 dark:hover:text-red-400 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition opacity-0 group-hover:opacity-100"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
