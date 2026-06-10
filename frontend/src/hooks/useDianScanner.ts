'use client';

import { useState, useCallback } from 'react';
import { apiPost } from '@/lib/api';

export type ScanState = 'idle' | 'scanning' | 'processing' | 'confirm' | 'saving';

export interface DianInvoiceData {
  emisor:    string | null;
  nit:       string | null;
  fecha:     string | null;
  total:     number | null;
  subtotal:  number | null;
  iva:       number | null;
  cufe:      string | null;
  categoria: string;
  rawUrl:    string;
}

export function useDianScanner(onSuccess: () => void) {
  const [state,    setState]    = useState<ScanState>('idle');
  const [invoice,  setInvoice]  = useState<DianInvoiceData | null>(null);
  const [error,    setError]    = useState<string | null>(null);

  const startScan = useCallback(() => {
    setError(null);
    setState('scanning');
  }, []);

  const cancelScan = useCallback(() => {
    setState('idle');
    setInvoice(null);
    setError(null);
  }, []);

  // Llamado por QrScanner cuando detecta el código QR
  const handleQrDetected = useCallback(async (url: string) => {
    setState('processing');
    setError(null);
    try {
      const data = await apiPost<DianInvoiceData>('/transactions/scan-dian', { url });
      setInvoice(data);
      setState('confirm');
    } catch (err) {
      setError((err as Error).message ?? 'Error al leer la factura DIAN');
      setState('idle');
    }
  }, []);

  // Llamado desde el modal de confirmación con los datos finales
  const confirmAndSave = useCallback(async (payload: {
    bankAccountId: string;
    categoryId:    string;
    description:   string;
    amount:        number;
  }) => {
    setState('saving');
    try {
      await apiPost('/transactions', {
        ...payload,
        type: 'EXPENSE',
        date: invoice?.fecha ? new Date(invoice.fecha).toISOString() : new Date().toISOString(),
      });
      setState('idle');
      setInvoice(null);
      onSuccess();
    } catch (err) {
      setError((err as Error).message ?? 'Error al guardar la transacción');
      setState('confirm');
    }
  }, [invoice, onSuccess]);

  return {
    state,
    invoice,
    error,
    startScan,
    cancelScan,
    handleQrDetected,
    confirmAndSave,
  };
}
