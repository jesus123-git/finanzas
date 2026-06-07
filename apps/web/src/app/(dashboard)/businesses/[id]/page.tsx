'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Business, DashboardKPIs } from '@/types';
import Link from 'next/link';
import { ArrowLeft, Users, FileText, TrendingUp, TrendingDown, DollarSign, ArrowRightLeft } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { useEffect } from 'react';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

function formatCOP(amount: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(amount);
}

export default function BusinessDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) router.push('/login');
  }, [isAuthenticated, router]);

  const { data: business } = useQuery({
    queryKey: ['business', id],
    queryFn: async () => (await api.get<Business>(`/businesses/${id}`)).data,
    enabled: !!id,
  });

  const { data: kpis } = useQuery({
    queryKey: ['business-dashboard', id],
    queryFn: async () => (await api.get<DashboardKPIs>(`/businesses/${id}/dashboard`)).data,
    enabled: !!id,
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Navbar */}
      <nav className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition">
              <ArrowLeft size={20} />
            </Link>
            <span className="font-semibold text-gray-900 dark:text-white">{business?.name ?? '...'}</span>
            {business?.nit && <span className="text-sm text-gray-400 dark:text-gray-500">NIT: {business.nit}</span>}
          </div>
          <ThemeToggle />
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* KPIs del mes */}
        <div>
          <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Este mes</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 bg-green-50 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                  <TrendingUp size={18} className="text-green-600 dark:text-green-400" />
                </div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Ingresos</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCOP(kpis?.currentMonth.income ?? 0)}</p>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 bg-red-50 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
                  <TrendingDown size={18} className="text-red-500 dark:text-red-400" />
                </div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Gastos</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCOP(kpis?.currentMonth.expenses ?? 0)}</p>
            </div>

            <div className={`bg-white dark:bg-gray-900 rounded-xl border p-5 ${(kpis?.currentMonth.profit ?? 0) >= 0 ? 'border-green-100 dark:border-green-900' : 'border-red-100 dark:border-red-900'}`}>
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${(kpis?.currentMonth.profit ?? 0) >= 0 ? 'bg-blue-50 dark:bg-blue-900/30' : 'bg-red-50 dark:bg-red-900/30'}`}>
                  <DollarSign size={18} className={(kpis?.currentMonth.profit ?? 0) >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-500 dark:text-red-400'} />
                </div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Utilidad</span>
              </div>
              <p className={`text-2xl font-bold ${(kpis?.currentMonth.profit ?? 0) >= 0 ? 'text-gray-900 dark:text-white' : 'text-red-500 dark:text-red-400'}`}>
                {formatCOP(kpis?.currentMonth.profit ?? 0)}
              </p>
            </div>
          </div>
        </div>

        {/* Cartera pendiente */}
        {(kpis?.pendingCollection.total ?? 0) > 0 && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-100 dark:border-yellow-800 rounded-xl p-5 flex items-center justify-between">
            <div>
              <p className="font-medium text-yellow-800 dark:text-yellow-300">Cartera pendiente de cobro</p>
              <p className="text-sm text-yellow-600 dark:text-yellow-400">{kpis?.pendingCollection.count} factura(s) por cobrar</p>
            </div>
            <p className="text-xl font-bold text-yellow-800 dark:text-yellow-300">{formatCOP(kpis?.pendingCollection.total ?? 0)}</p>
          </div>
        )}

        {/* Accesos rápidos */}
        <div>
          <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Gestionar</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              href={`/businesses/${id}/transactions`}
              className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-5 hover:border-blue-200 dark:hover:border-blue-700 hover:shadow-sm transition flex items-center gap-4"
            >
              <div className="w-10 h-10 bg-green-50 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                <ArrowRightLeft size={20} className="text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">Transacciones</p>
                <p className="text-sm text-gray-400 dark:text-gray-500">{business?._count?.transactions ?? 0} registradas</p>
              </div>
            </Link>

            <Link
              href={`/businesses/${id}/customers`}
              className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-5 hover:border-blue-200 dark:hover:border-blue-700 hover:shadow-sm transition flex items-center gap-4"
            >
              <div className="w-10 h-10 bg-purple-50 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                <Users size={20} className="text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">Clientes</p>
                <p className="text-sm text-gray-400 dark:text-gray-500">{business?._count?.customers ?? 0} registrados</p>
              </div>
            </Link>

            <Link
              href={`/businesses/${id}/invoices`}
              className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-5 hover:border-blue-200 dark:hover:border-blue-700 hover:shadow-sm transition flex items-center gap-4"
            >
              <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                <FileText size={20} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">Facturas</p>
                <p className="text-sm text-gray-400 dark:text-gray-500">{business?._count?.invoices ?? 0} emitidas</p>
              </div>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
