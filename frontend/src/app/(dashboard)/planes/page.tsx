'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Check, X, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/context/auth.context';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

const PLANS = [
  {
    key: 'FREE' as const,
    name: 'Gratuito',
    price: '$0',
    period: 'siempre',
    description: 'Para empezar a ordenar tus finanzas',
    color: 'border-gray-200 dark:border-gray-700',
    badge: null,
    features: [
      '1 empresa activa',
      '15 facturas por mes',
      '15 clientes',
      '10 productos en catálogo',
      '5 cotizaciones por mes',
      '5 proveedores',
      'Seguimiento de inventario',
      'Finanzas personales completas',
    ],
    blocked: ['Listas de precios diferenciadas', 'Usuarios adicionales'],
    cta: null,
  },
  {
    key: 'PRO' as const,
    name: 'Nomi PRO',
    price: '$16.900',
    period: 'mes',
    description: 'Para negocios que están creciendo',
    color: 'border-blue-500',
    badge: 'Más popular',
    features: [
      'Todo en Gratuito',
      'Facturas, clientes y productos ilimitados',
      'Cotizaciones y proveedores ilimitados',
      'Listas de precios diferenciadas',
      '1 usuario adicional (Editor o Viewer)',
      'Soporte prioritario',
    ],
    blocked: ['Más de 1 empresa', 'Más de 1 usuario adicional'],
    cta: 'PRO' as const,
  },
  {
    key: 'EMPRESA' as const,
    name: 'Nomi Empresa',
    price: '$34.900',
    period: 'mes',
    description: 'Para grupos y múltiples negocios',
    color: 'border-gray-200 dark:border-gray-700',
    badge: null,
    features: [
      'Todo en Nomi PRO',
      'Empresas ilimitadas',
      'Usuarios ilimitados por empresa',
      'Soporte prioritario',
    ],
    blocked: [],
    cta: 'EMPRESA' as const,
  },
];

function PlanesContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const status = searchParams.get('status');
  const currentPlan = (user as any)?.plan ?? 'FREE';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <nav className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/personal" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition">
              <ArrowLeft size={20} />
            </Link>
            <span className="font-semibold text-gray-900 dark:text-white">Planes</span>
          </div>
          <ThemeToggle />
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-10 space-y-10">

        {status === 'success' && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 text-center text-green-700 dark:text-green-300 font-medium">
            ¡Plan activado correctamente! Ya tienes acceso a todas las funciones.
          </div>
        )}
        {status === 'error' && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-center text-red-700 dark:text-red-300 font-medium">
            Hubo un problema con el pago. Por favor inténtalo de nuevo.
          </div>
        )}

        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Elige tu plan</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">Sin contratos. Cancela cuando quieras.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map(p => {
            const isCurrent = currentPlan === p.key;
            return (
              <div
                key={p.key}
                className={`bg-white dark:bg-gray-900 rounded-2xl border-2 p-6 flex flex-col ${p.color} ${p.key === 'PRO' ? 'ring-2 ring-blue-500/20' : ''}`}
              >
                {p.badge && (
                  <span className="inline-block self-start mb-3 text-xs font-semibold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-full">
                    {p.badge}
                  </span>
                )}
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">{p.name}</h2>
                <div className="mt-2 mb-1">
                  <span className="text-3xl font-bold text-gray-900 dark:text-white">{p.price}</span>
                  {p.period !== 'siempre' && <span className="text-gray-500 dark:text-gray-400 text-sm ml-1">/ {p.period}</span>}
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">{p.description}</p>

                <ul className="space-y-2 flex-1 mb-6">
                  {p.features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <Check size={15} className="text-green-500 flex-shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                  {p.blocked.map(f => (
                    <li key={f} className="flex items-start gap-2 text-sm text-gray-400 dark:text-gray-600">
                      <X size={15} className="flex-shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <div className="w-full py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 text-center text-sm text-gray-500 dark:text-gray-400 font-medium">
                    Plan actual
                  </div>
                ) : p.cta ? (
                  <Link
                    href={`/checkout?plan=${p.cta}`}
                    className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-center text-sm font-semibold transition block"
                  >
                    Activar {p.name}
                  </Link>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="text-center text-xs text-gray-400 dark:text-gray-600">
          Precios en COP · IVA no incluido · Renovación mensual automática
        </div>
      </main>
    </div>
  );
}

export default function PlanesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 dark:bg-gray-950" />}>
      <PlanesContent />
    </Suspense>
  );
}
