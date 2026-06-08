'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Business, DashboardKPIs } from '@/types';
import Link from 'next/link';
import {
  ArrowLeft, Users, FileText, TrendingUp, TrendingDown, DollarSign,
  ArrowRightLeft, Package, Tag, ClipboardList, Truck, ShoppingCart, BarChart2,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { useEffect } from 'react';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCOP(amount: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(amount);
}

function formatCOPShort(n: number) {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

// ─── Tooltip personalizado ────────────────────────────────────────────────────

const MiniTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-3 shadow-lg text-xs">
      <p className="font-semibold text-gray-700 dark:text-gray-200 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} className="flex items-center gap-1.5" style={{ color: p.color }}>
          <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: p.color }} />
          {p.name}: {formatCOP(p.value)}
        </p>
      ))}
    </div>
  );
};

// ─── Card de acceso rápido ────────────────────────────────────────────────────

function QuickCard({ href, icon: Icon, iconBg, iconColor, label, sub }: {
  href: string; icon: any; iconBg: string; iconColor: string; label: string; sub?: string;
}) {
  return (
    <Link
      href={href}
      className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-4 hover:border-blue-200 dark:hover:border-blue-700 hover:shadow-sm transition flex items-center gap-3"
    >
      <div className={`w-9 h-9 ${iconBg} rounded-lg flex items-center justify-center flex-shrink-0`}>
        <Icon size={18} className={iconColor} />
      </div>
      <div className="min-w-0">
        <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">{label}</p>
        {sub && <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{sub}</p>}
      </div>
    </Link>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────

interface PnLMonth { month: string; income: number; expenses: number; profit: number }
interface PnLData {
  data: PnLMonth[];
  summary: { totalIncome: number; totalExpenses: number; netProfit: number; margin: number };
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

  const { data: pnl } = useQuery({
    queryKey: ['reports-pnl', id, 6],
    queryFn: async () => (await api.get<PnLData>(`/businesses/${id}/reports/pnl?months=6`)).data,
    enabled: !!id,
  });

  const hasChartData = (pnl?.data ?? []).some(m => m.income > 0 || m.expenses > 0);
  const profit = kpis?.currentMonth.profit ?? 0;

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

        {/* ── KPIs + gráfica ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* KPIs columna izquierda */}
          <div className="flex flex-col gap-4">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Este mes</p>

            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-5 flex items-center gap-4">
              <div className="w-10 h-10 bg-green-50 dark:bg-green-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
                <TrendingUp size={20} className="text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">Ingresos</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{formatCOP(kpis?.currentMonth.income ?? 0)}</p>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-5 flex items-center gap-4">
              <div className="w-10 h-10 bg-red-50 dark:bg-red-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
                <TrendingDown size={20} className="text-red-500 dark:text-red-400" />
              </div>
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">Gastos</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{formatCOP(kpis?.currentMonth.expenses ?? 0)}</p>
              </div>
            </div>

            <div className={`bg-white dark:bg-gray-900 rounded-xl border p-5 flex items-center gap-4 transition-colors ${profit >= 0 ? 'border-green-200 dark:border-green-800/50' : 'border-red-200 dark:border-red-800/50'}`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${profit >= 0 ? 'bg-blue-50 dark:bg-blue-900/30' : 'bg-red-50 dark:bg-red-900/30'}`}>
                <DollarSign size={20} className={profit >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-500 dark:text-red-400'} />
              </div>
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">Utilidad</p>
                <p className={`text-xl font-bold ${profit >= 0 ? 'text-gray-900 dark:text-white' : 'text-red-500 dark:text-red-400'}`}>
                  {formatCOP(profit)}
                </p>
              </div>
            </div>
          </div>

          {/* Gráfica últimos 6 meses */}
          <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900 dark:text-white text-sm">Tendencia · últimos 6 meses</h2>
              <Link href={`/businesses/${id}/reports`} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
                Ver reporte completo →
              </Link>
            </div>

            {!hasChartData ? (
              <div className="h-52 flex flex-col items-center justify-center text-gray-300 dark:text-gray-600">
                <BarChart2 size={36} className="mb-2" />
                <p className="text-sm">Registra transacciones o facturas para ver la gráfica</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={210}>
                <AreaChart data={pnl?.data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.12} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" className="dark:stroke-gray-800" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={formatCOPShort} tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={55} />
                  <Tooltip content={<MiniTooltip />} />
                  <Area type="monotone" dataKey="income" name="Ingresos" stroke="#22c55e" strokeWidth={2} fill="url(#colorIncome)" dot={false} activeDot={{ r: 5 }} />
                  <Area type="monotone" dataKey="expenses" name="Gastos" stroke="#ef4444" strokeWidth={2} fill="url(#colorExpenses)" dot={false} activeDot={{ r: 5 }} />
                </AreaChart>
              </ResponsiveContainer>
            )}

            {/* Mini resumen debajo de la gráfica */}
            {hasChartData && (
              <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-gray-50 dark:border-gray-800">
                <div className="text-center">
                  <p className="text-xs text-gray-400 dark:text-gray-500">Total ingresos</p>
                  <p className="text-sm font-bold text-green-600 dark:text-green-400">{formatCOPShort(pnl?.summary.totalIncome ?? 0)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-400 dark:text-gray-500">Total gastos</p>
                  <p className="text-sm font-bold text-red-500 dark:text-red-400">{formatCOPShort(pnl?.summary.totalExpenses ?? 0)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-400 dark:text-gray-500">Utilidad neta</p>
                  <p className={`text-sm font-bold ${(pnl?.summary.netProfit ?? 0) >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-500 dark:text-red-400'}`}>
                    {formatCOPShort(pnl?.summary.netProfit ?? 0)}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Cartera pendiente ── */}
        {(kpis?.pendingCollection.total ?? 0) > 0 && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="font-medium text-amber-800 dark:text-amber-300">Cartera pendiente de cobro</p>
              <p className="text-sm text-amber-600 dark:text-amber-400">{kpis?.pendingCollection.count} factura(s) por cobrar</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold text-amber-800 dark:text-amber-300">{formatCOP(kpis?.pendingCollection.total ?? 0)}</p>
              <Link href={`/businesses/${id}/reports`} className="text-xs text-amber-600 dark:text-amber-400 hover:underline">Ver detalle →</Link>
            </div>
          </div>
        )}

        {/* ── Accesos rápidos ── */}
        <div>
          <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Gestionar</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            <QuickCard href={`/businesses/${id}/transactions`}  icon={ArrowRightLeft} iconBg="bg-green-50 dark:bg-green-900/30"  iconColor="text-green-600 dark:text-green-400"  label="Transacciones"  sub={`${business?._count?.transactions ?? 0} registradas`} />
            <QuickCard href={`/businesses/${id}/customers`}     icon={Users}          iconBg="bg-purple-50 dark:bg-purple-900/30" iconColor="text-purple-600 dark:text-purple-400" label="Clientes"       sub={`${business?._count?.customers ?? 0} registrados`} />
            <QuickCard href={`/businesses/${id}/products`}      icon={Package}        iconBg="bg-orange-50 dark:bg-orange-900/30" iconColor="text-orange-600 dark:text-orange-400" label="Productos"      sub="Catálogo" />
            <QuickCard href={`/businesses/${id}/price-lists`}   icon={Tag}            iconBg="bg-yellow-50 dark:bg-yellow-900/30" iconColor="text-yellow-600 dark:text-yellow-400" label="Precios"        sub="Listas de precios" />
            <QuickCard href={`/businesses/${id}/quotes`}        icon={ClipboardList}  iconBg="bg-teal-50 dark:bg-teal-900/30"    iconColor="text-teal-600 dark:text-teal-400"    label="Cotizaciones"  sub="Presupuestos" />
            <QuickCard href={`/businesses/${id}/invoices`}      icon={FileText}       iconBg="bg-blue-50 dark:bg-blue-900/30"    iconColor="text-blue-600 dark:text-blue-400"    label="Facturas"      sub={`${business?._count?.invoices ?? 0} emitidas`} />
            <QuickCard href={`/businesses/${id}/suppliers`}     icon={Truck}          iconBg="bg-slate-50 dark:bg-slate-900/30"  iconColor="text-slate-600 dark:text-slate-400"  label="Proveedores"   sub="Directorio" />
            <QuickCard href={`/businesses/${id}/purchases`}     icon={ShoppingCart}   iconBg="bg-rose-50 dark:bg-rose-900/30"    iconColor="text-rose-600 dark:text-rose-400"    label="Compras"       sub="Órdenes de compra" />
            <QuickCard href={`/businesses/${id}/reports`}       icon={BarChart2}      iconBg="bg-indigo-50 dark:bg-indigo-900/30" iconColor="text-indigo-600 dark:text-indigo-400" label="Reportes"     sub="P&L · Cartera" />
          </div>
        </div>

      </main>
    </div>
  );
}
