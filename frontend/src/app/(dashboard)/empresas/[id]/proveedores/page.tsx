'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { api } from '@/lib/axios';
import Link from 'next/link';
import { ArrowLeft, Plus, X, Truck, Pencil, Trash2, Phone, Mail, User } from 'lucide-react';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

interface Supplier {
  id: string; name: string; nit?: string; email?: string; phone?: string;
  address?: string; contactName?: string; notes?: string;
  _count?: { purchases: number };
}

interface FormData {
  name: string; nit?: string; email?: string; phone?: string;
  address?: string; contactName?: string; notes?: string;
}

const inputCls = 'w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition text-sm';

export default function SuppliersPage() {
  const { id: businessId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);

  const { data: suppliers, isLoading } = useQuery({
    queryKey: ['suppliers', businessId],
    queryFn: async () => (await api.get<Supplier[]>(`/businesses/${businessId}/suppliers`)).data,
    enabled: !!businessId,
  });

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<FormData>();

  const openCreate = () => { reset({}); setEditing(null); setShowForm(true); };
  const openEdit = (s: Supplier) => {
    reset({ name: s.name, nit: s.nit, email: s.email, phone: s.phone, address: s.address, contactName: s.contactName, notes: s.notes });
    setEditing(s);
    setShowForm(true);
  };

  const saveMutation = useMutation({
    mutationFn: (data: FormData) =>
      editing
        ? api.patch(`/businesses/${businessId}/suppliers/${editing.id}`, data)
        : api.post(`/businesses/${businessId}/suppliers`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers', businessId] });
      setShowForm(false); reset({});
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/businesses/${businessId}/suppliers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers', businessId] });
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
            <span className="font-semibold text-gray-900 dark:text-white">Proveedores</span>
          </div>
          <ThemeToggle />
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Proveedores</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">{suppliers?.length ?? 0} registrados</p>
          </div>
          <button onClick={openCreate} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg font-medium transition">
            <Plus size={18} /> Nuevo proveedor
          </button>
        </div>

        {/* Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-lg p-6 shadow-xl border border-gray-100 dark:border-gray-800 my-8">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">{editing ? 'Editar proveedor' : 'Nuevo proveedor'}</h2>
                <button onClick={() => { setShowForm(false); reset({}); }} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X size={20} /></button>
              </div>

              <form onSubmit={handleSubmit((d) => saveMutation.mutate(d))} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre / Razón social *</label>
                  <input {...register('name', { required: true })} placeholder="Distribuidora XYZ S.A.S." className={inputCls} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">NIT</label>
                    <input {...register('nit')} placeholder="900.123.456-7" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Teléfono</label>
                    <input {...register('phone')} placeholder="310 000 0000" className={inputCls} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                    <input {...register('email')} type="email" placeholder="proveedor@empresa.com" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contacto</label>
                    <input {...register('contactName')} placeholder="Nombre del contacto" className={inputCls} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Dirección</label>
                  <input {...register('address')} placeholder="Calle 123 # 45-67, Bogotá" className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notas</label>
                  <textarea {...register('notes')} rows={2} placeholder="Condiciones de pago, observaciones..." className={`${inputCls} resize-none`} />
                </div>
                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => { setShowForm(false); reset({}); }} className="flex-1 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 py-2.5 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition">Cancelar</button>
                  <button type="submit" disabled={isSubmitting} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-2.5 rounded-lg font-medium transition">
                    {isSubmitting ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear proveedor'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Confirmación de eliminación */}
        <ConfirmDialog
          open={!!confirmDelete}
          title="Desactivar proveedor"
          message={`¿Desactivar a "${confirmDelete?.name}"? Las órdenes de compra existentes se conservarán.`}
          confirmLabel="Desactivar"
          onConfirm={() => confirmDelete && deleteMutation.mutate(confirmDelete.id)}
          onCancel={() => setConfirmDelete(null)}
        />

        {/* Lista */}
        {isLoading ? (
          <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-5 animate-pulse h-20" />)}</div>
        ) : suppliers?.length === 0 ? (
          <div className="text-center py-16">
            <Truck size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
            <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">No hay proveedores aún</h3>
            <button onClick={openCreate} className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition">
              <Plus size={18} /> Agregar primer proveedor
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {suppliers?.map((s) => (
              <div key={s.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-orange-50 dark:bg-orange-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Truck size={20} className="text-orange-600 dark:text-orange-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">{s.name}</h3>
                      {s.nit && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">NIT: {s.nit}</p>}
                      <div className="flex flex-wrap gap-3 mt-2">
                        {s.contactName && (
                          <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                            <User size={12} /> {s.contactName}
                          </span>
                        )}
                        {s.phone && (
                          <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                            <Phone size={12} /> {s.phone}
                          </span>
                        )}
                        {s.email && (
                          <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                            <Mail size={12} /> {s.email}
                          </span>
                        )}
                      </div>
                      {s.notes && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 italic">{s.notes}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-4 flex-shrink-0">
                    <span className="text-xs text-gray-400 dark:text-gray-500 mr-2">{s._count?.purchases ?? 0} órdenes</span>
                    <button onClick={() => openEdit(s)} className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition">
                      <Pencil size={16} />
                    </button>
                    <button onClick={() => setConfirmDelete({ id: s.id, name: s.name })} className="p-2 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
