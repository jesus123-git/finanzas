'use client';

import { useRouter } from 'next/navigation';
import { Lock } from 'lucide-react';
import { usePlan } from '@/context/PlanContext';

const PLAN_ORDER = { FREE: 0, PRO: 1, EMPRESA: 2 } as const;

interface Props {
  requiredPlan: 'PRO' | 'EMPRESA';
  featureName: string;
  featureDescription: string;
  children: React.ReactNode;
}

export function PlanGate({ requiredPlan, featureName, featureDescription, children }: Props) {
  const { plan } = usePlan();
  const router = useRouter();

  if (PLAN_ORDER[plan] >= PLAN_ORDER[requiredPlan]) return <>{children}</>;

  return (
    <div className="min-h-[300px] flex items-center justify-center">
      <div className="text-center max-w-sm mx-auto px-6">
        <div className="w-14 h-14 bg-blue-50 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Lock size={24} className="text-blue-600 dark:text-blue-400" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{featureName}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{featureDescription}</p>
        <button
          onClick={() => router.push('/planes')}
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium transition text-sm"
        >
          Ver planes
        </button>
      </div>
    </div>
  );
}
