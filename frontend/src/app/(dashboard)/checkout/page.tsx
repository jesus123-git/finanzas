'use client';

import { useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { api } from '@/lib/axios';

function CheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const plan = searchParams.get('plan');

  useEffect(() => {
    if (!plan) { router.replace('/planes'); return; }

    api.post('/subscriptions/checkout', { plan })
      .then(({ data }) => {
        if (data.status === 'GATEWAY_PENDING') {
          router.replace('/planes');
          return;
        }
        window.location.href = data.url;
      })
      .catch(() => router.replace('/planes?status=error'));
  }, [plan, router]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-10 h-10 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-gray-500 dark:text-gray-400 text-sm">Preparando tu pago...</p>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 dark:bg-gray-950" />}>
      <CheckoutContent />
    </Suspense>
  );
}
