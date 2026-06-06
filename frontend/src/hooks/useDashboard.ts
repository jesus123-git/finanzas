'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiGet, removeToken } from '@/lib/api';
import { removeSessionCookie } from '@/lib/cookies';
import type {
  BalanceSummary,
  BankAccount,
  DashboardData,
  PaginatedTransactions,
} from '@/types/dashboard.types';

interface UseDashboardResult {
  data: DashboardData | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useDashboard(): UseDashboardResult {
  const router  = useRouter();
  const [data,    setData]    = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Disparamos las tres peticiones en paralelo.
      // Promise.all falla si CUALQUIERA falla — esto es intencional:
      // si el token expiró, las tres darán 401 y el catch lo maneja.
      const [summary, accounts, txResponse] = await Promise.all([
        apiGet<BalanceSummary>('/bank-accounts/summary'),
        apiGet<BankAccount[]>('/bank-accounts'),
        apiGet<PaginatedTransactions>('/transactions?limit=10&page=1'),
      ]);

      setData({
        summary,
        accounts,
        recentTransactions: txResponse.data,
        totalIncome:  txResponse.totalIncome,
        totalExpense: txResponse.totalExpense,
      });
    } catch (err) {
      const status = (err as Error & { status?: number }).status;

      // 401 → token expirado o inválido → limpiamos sesión y redirigimos
      if (status === 401) {
        removeToken();
        removeSessionCookie();
        router.push('/login');
        return;
      }

      setError(err instanceof Error ? err.message : 'Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return { data, loading, error, refetch: fetchAll };
}
