'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/auth.context';
import { apiGet, apiPost } from '@/lib/api';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { WorkspaceSwitcher } from '@/components/ui/WorkspaceSwitcher';
import { UserMenu } from '@/components/ui/UserMenu';
import { Logo } from '@/components/ui/Logo';
import { currencyOptions } from '@/lib/currencies';
import { Building2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import { ToastContainer, useToast } from '@/components/ui/Toast';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Business {
  id: string;
  name: string;
  nit?: string;
  legalName?: string;
  taxRegime?: string;
  currency?: string;
  isActive: boolean;
  createdAt: string;
  _count?: { customers: number; invoices: number; bizTransactions: number };
}

// ─── Selector de Empresa ──────────────────────────────────────────────────────

export default function EmpresasPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { toasts, toast, dismissToast } = useToast();

  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading]       = useState(true);
  const [creating, setCreating]     = useState(false);
  const [showForm, setShowForm]     = useState(false);
  const [formData, setFormData]     = useState({ name: '', nit: '', taxRegime: 'SIMPLE', currency: 'COP' });

  // Cargar empresas del usuario
  useEffect(() => {
    apiGet<Business[]>('/businesses')
      .then(setBusinesses)
      .catch(() => toast('Error cargando empresas', 'error'))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    setCreating(true);
    try {
      // No enviar campos vacíos: el NIT es opcional y el backend espera
      // undefined (no string vacío) cuando el usuario no lo diligencia
      const payload = {
        name: formData.name.trim(),
        taxRegime: formData.taxRegime,
        currency: formData.currency,
        ...(formData.nit.trim() && { nit: formData.nit.trim() }),
      };
      const biz = await apiPost<Business>('/businesses', payload);
      toast(`Empresa "${biz.name}" creada 🎉`, 'success');
      setBusinesses(prev => [biz, ...prev]);
      setShowForm(false);
      setFormData({ name: '', nit: '', taxRegime: 'SIMPLE', currency: 'COP' });
      // Navegar al dashboard de la empresa recién creada
      router.push(`/empresas/${biz.id}`);
    } catch {
      toast('Error creando la empresa', 'error');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">

      {/* Header */}
      <header className="bg-white/90 dark:bg-slate-950/90 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800/80 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center gap-3">
          <div className="flex-shrink-0">
            <span className="hidden md:block"><Logo size={32} href="/empresas" /></span>
            <span className="md:hidden"><Logo size={32} markOnly href="/empresas" /></span>
          </div>

          <WorkspaceSwitcher />
          <div className="flex-1" />

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <div className="pl-3 border-l border-slate-200 dark:border-slate-700 flex items-center">
              <UserMenu />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* Encabezado */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Mis Empresas</h1>
            <p className="text-slate-400 dark:text-slate-500 text-sm mt-0.5">
              Selecciona una empresa para gestionar sus finanzas
            </p>
          </div>
          <Button
            onClick={() => setShowForm(true)}
            className="gap-1.5 text-sm bg-violet-600 hover:bg-violet-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Nueva empresa
          </Button>
        </div>

        {/* Formulario inline para crear empresa */}
        {showForm && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-violet-200 dark:border-violet-800 p-6 animate-fade-up">
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-4">Nueva empresa</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Nombre de la empresa <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    autoFocus
                    required
                    maxLength={100}
                    value={formData.name}
                    onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                    placeholder="Ej: Ferretería Central S.A.S."
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    NIT{' '}
                    <span className="text-xs font-normal text-slate-400 dark:text-slate-500">(opcional)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.nit}
                    onChange={e => setFormData(p => ({ ...p, nit: e.target.value }))}
                    placeholder="Ej: 900.123.456-7"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                    ¿Aún no formalizas tu emprendimiento? Puedes agregarlo más adelante.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Régimen tributario</label>
                  <select
                    value={formData.taxRegime}
                    onChange={e => setFormData(p => ({ ...p, taxRegime: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  >
                    <option value="SIMPLE">Simple (SIMPLE)</option>
                    <option value="ORDINARIO">Ordinario (ORDINARIO)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Moneda de operación</label>
                  <select
                    value={formData.currency}
                    onChange={e => setFormData(p => ({ ...p, currency: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  >
                    {currencyOptions.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                    Todos los precios, facturas y reportes de esta empresa usarán esta moneda.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 pt-1">
                <Button type="submit" disabled={creating} className="bg-violet-600 hover:bg-violet-700 text-sm">
                  {creating ? 'Creando…' : 'Crear empresa'}
                </Button>
                <button type="button" onClick={() => setShowForm(false)} className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Lista de empresas */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3].map(i => (
              <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-6 h-40 animate-pulse" />
            ))}
          </div>
        ) : businesses.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-2xl bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center">
                <Building2 size={32} className="text-violet-600 dark:text-violet-400" />
              </div>
            </div>
            <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-1">No tienes empresas aún</h2>
            <p className="text-sm text-slate-400 dark:text-slate-500 mb-6">
              Crea tu primera empresa para gestionar facturas, clientes y finanzas.
            </p>
            <Button onClick={() => setShowForm(true)} className="bg-violet-600 hover:bg-violet-700 text-sm">
              + Crear primera empresa
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {businesses.map(biz => (
              <Link key={biz.id} href={`/empresas/${biz.id}`}>
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-6 hover:border-violet-300 dark:hover:border-violet-700 hover:shadow-md transition-all duration-200 cursor-pointer group h-full">
                  {/* Avatar */}
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center flex-shrink-0 group-hover:bg-violet-200 dark:group-hover:bg-violet-900/60 transition-colors">
                      <Building2 size={22} className="text-violet-600 dark:text-violet-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-slate-800 dark:text-slate-100 truncate">{biz.name}</h3>
                      {biz.nit && <p className="text-xs text-slate-400 dark:text-slate-500">NIT: {biz.nit}</p>}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-2 mt-auto">
                    {[
                      { label: 'Clientes',   value: biz._count?.customers ?? 0 },
                      { label: 'Facturas',   value: biz._count?.invoices ?? 0 },
                      { label: 'Movimientos', value: biz._count?.bizTransactions ?? 0 },
                    ].map(s => (
                      <div key={s.label} className="text-center bg-slate-50 dark:bg-slate-700/50 rounded-lg py-2">
                        <p className="text-base font-bold text-slate-700 dark:text-slate-200">{s.value}</p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-tight">{s.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Régimen */}
                  {biz.taxRegime && (
                    <div className="mt-3 flex items-center gap-1.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300">
                        {biz.taxRegime}
                      </span>
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
