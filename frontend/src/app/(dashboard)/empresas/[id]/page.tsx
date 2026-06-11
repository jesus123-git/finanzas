'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAuth } from '@/context/auth.context';
import { apiGet } from '@/lib/api';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { WorkspaceSwitcher } from '@/components/ui/WorkspaceSwitcher';
import { UserMenu } from '@/components/ui/UserMenu';
import { Logo } from '@/components/ui/Logo';
import { ExcelImportWizard } from '@/components/excel/ExcelImportWizard';
import { formatCurrency } from '@/lib/utils';
import {
  TrendingUp, TrendingDown, DollarSign, Clock,
  Users, FileText, Package, ClipboardList,
  Truck, ShoppingCart, Tag, BarChart2,
  type LucideIcon,
} from 'lucide-react';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Business {
  id: string; name: string; nit?: string; taxRegime?: string;
}

interface KPIs {
  currentMonth: { income: number; expenses: number; profit: number };
  pendingCollection: { total: number; count: number };
}

// ─── Módulos de navegación ────────────────────────────────────────────────────

interface NavItem {
  href:    string;
  label:   string;
  icon:    LucideIcon;
  desc:    string;
  iconBg:  string;
  iconCl:  string;
  border:  string;
  bg:      string;
}

const getNavItems = (id: string): NavItem[] => [
  {
    href: `/empresas/${id}/clientes`, label: 'Clientes', desc: 'CRM y estado de cuenta',
    icon: Users,
    bg: 'bg-sky-50 dark:bg-sky-900/20', border: 'border-sky-100 dark:border-sky-800/40',
    iconBg: 'bg-sky-100 dark:bg-sky-800/40', iconCl: 'text-sky-600 dark:text-sky-400',
  },
  {
    href: `/empresas/${id}/facturas`, label: 'Facturas', desc: 'Emitir y gestionar facturas',
    icon: FileText,
    bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-100 dark:border-emerald-800/40',
    iconBg: 'bg-emerald-100 dark:bg-emerald-800/40', iconCl: 'text-emerald-600 dark:text-emerald-400',
  },
  {
    href: `/empresas/${id}/productos`, label: 'Productos', desc: 'Catálogo e inventario',
    icon: Package,
    bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-100 dark:border-amber-800/40',
    iconBg: 'bg-amber-100 dark:bg-amber-800/40', iconCl: 'text-amber-600 dark:text-amber-400',
  },
  {
    href: `/empresas/${id}/cotizaciones`, label: 'Cotizaciones', desc: 'Generar y convertir cotiz.',
    icon: ClipboardList,
    bg: 'bg-violet-50 dark:bg-violet-900/20', border: 'border-violet-100 dark:border-violet-800/40',
    iconBg: 'bg-violet-100 dark:bg-violet-800/40', iconCl: 'text-violet-600 dark:text-violet-400',
  },
  {
    href: `/empresas/${id}/proveedores`, label: 'Proveedores', desc: 'Directorio de proveedores',
    icon: Truck,
    bg: 'bg-orange-50 dark:bg-orange-900/20', border: 'border-orange-100 dark:border-orange-800/40',
    iconBg: 'bg-orange-100 dark:bg-orange-800/40', iconCl: 'text-orange-600 dark:text-orange-400',
  },
  {
    href: `/empresas/${id}/compras`, label: 'Órd. de Compra', desc: 'Gestión de compras y pagos',
    icon: ShoppingCart,
    bg: 'bg-rose-50 dark:bg-rose-900/20', border: 'border-rose-100 dark:border-rose-800/40',
    iconBg: 'bg-rose-100 dark:bg-rose-800/40', iconCl: 'text-rose-600 dark:text-rose-400',
  },
  {
    href: `/empresas/${id}/listas-precios`, label: 'Listas de precios', desc: 'Mayorista, minorista, especial',
    icon: Tag,
    bg: 'bg-cyan-50 dark:bg-cyan-900/20', border: 'border-cyan-100 dark:border-cyan-800/40',
    iconBg: 'bg-cyan-100 dark:bg-cyan-800/40', iconCl: 'text-cyan-600 dark:text-cyan-400',
  },
  {
    href: `/empresas/${id}/reportes`, label: 'Reportes', desc: 'P&L, cartera, top productos',
    icon: BarChart2,
    bg: 'bg-indigo-50 dark:bg-indigo-900/20', border: 'border-indigo-100 dark:border-indigo-800/40',
    iconBg: 'bg-indigo-100 dark:bg-indigo-800/40', iconCl: 'text-indigo-600 dark:text-indigo-400',
  },
];

// ─── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, icon: Icon, iconBg, iconCl, loading }: {
  label: string; value: number; loading: boolean;
  icon: LucideIcon;
  iconBg: string; iconCl: string;
}) {
  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5 animate-pulse">
        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mb-3" />
        <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
      </div>
    );
  }
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5">
      <div className="flex items-center gap-2.5 mb-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${iconBg}`}>
          <Icon size={16} className={iconCl} />
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      </div>
      <p className={`text-2xl font-bold ${iconCl}`}>
        {formatCurrency(value, 'COP')}
      </p>
    </div>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function BusinessDashboardPage() {
  const { id }           = useParams<{ id: string }>();
  const { user } = useAuth();

  const [business,    setBusiness]    = useState<Business | null>(null);
  const [kpis,        setKpis]        = useState<KPIs | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [excelOpen,   setExcelOpen]   = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      apiGet<Business>(`/businesses/${id}`),
      apiGet<KPIs>(`/businesses/${id}/dashboard`),
    ])
      .then(([biz, k]) => { setBusiness(biz); setKpis(k); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  const navItems = getNavItems(id as string);

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

            {/* Botón importar Excel empresa */}
            <button
              onClick={() => setExcelOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 active:scale-95 transition-all shadow-sm"
              title="Importar transacciones desde plantilla Excel empresa"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              <span className="hidden sm:inline">Importar Excel</span>
            </button>

            <Link
              href="/empresas"
              className="text-sm text-slate-500 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 px-2 py-1 rounded-lg hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors"
            >
              ← Mis empresas
            </Link>
            <div className="pl-3 border-l border-slate-200 dark:border-slate-700 flex items-center">
              <UserMenu />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* Encabezado empresa */}
        {loading ? (
          <div className="h-10 w-64 bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse" />
        ) : (
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
              {business?.name ?? 'Empresa'}
            </h1>
            <div className="flex items-center gap-3 mt-1">
              {business?.nit && (
                <span className="text-sm text-slate-400 dark:text-slate-500">NIT: {business.nit}</span>
              )}
              {business?.taxRegime && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300">
                  {business.taxRegime}
                </span>
              )}
            </div>
          </div>
        )}

        {/* KPIs del mes */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Ingresos del mes"   value={kpis?.currentMonth.income ?? 0}       icon={TrendingUp}   iconBg="bg-emerald-100 dark:bg-emerald-800/40" iconCl="text-emerald-600 dark:text-emerald-400" loading={loading} />
          <KpiCard label="Gastos del mes"      value={kpis?.currentMonth.expenses ?? 0}     icon={TrendingDown} iconBg="bg-rose-100 dark:bg-rose-800/40"     iconCl="text-rose-600 dark:text-rose-400"     loading={loading} />
          <KpiCard label="Utilidad neta"       value={kpis?.currentMonth.profit ?? 0}       icon={DollarSign}   iconBg="bg-violet-100 dark:bg-violet-800/40" iconCl="text-violet-600 dark:text-violet-400" loading={loading} />
          <KpiCard label="Cobros pendientes"   value={kpis?.pendingCollection.total ?? 0}   icon={Clock}        iconBg="bg-amber-100 dark:bg-amber-800/40"   iconCl="text-amber-600 dark:text-amber-400"   loading={loading} />
        </div>

        {/* Grid de módulos */}
        <div>
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-3">Gestionar</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {navItems.map(item => {
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href}>
                  <div className={`rounded-2xl border p-5 h-full hover:shadow-md hover:scale-[1.01] transition-all duration-200 cursor-pointer ${item.bg} ${item.border}`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${item.iconBg}`}>
                      <Icon size={20} className={item.iconCl} />
                    </div>
                    <p className={`font-bold text-sm leading-tight ${item.iconCl}`}>{item.label}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-tight">{item.desc}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

      </main>

      {/* Wizard importación Excel empresa */}
      <ExcelImportWizard
        open={excelOpen}
        mode="empresa"
        businessId={id as string}
        onClose={() => setExcelOpen(false)}
        onSuccess={() => {
          // Refrescar KPIs tras importación exitosa
          if (!id) return;
          Promise.all([
            apiGet<Business>(`/businesses/${id}`),
            apiGet<KPIs>(`/businesses/${id}/dashboard`),
          ])
            .then(([biz, k]) => { setBusiness(biz); setKpis(k); })
            .catch(console.error);
        }}
      />
    </div>
  );
}
