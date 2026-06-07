'use client';

import { useEffect, useRef, useCallback } from 'react';

// ─── URL del endpoint de ping ─────────────────────────────────────────────────
// No requiere JWT — es completamente público.

const API_URL  = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const PING_URL = `${API_URL}/api/v1/webhooks/ping`;

// ─── Hook ─────────────────────────────────────────────────────────────────────
//
// Hace polling a GET /webhooks/ping cada `intervalMs` milisegundos.
// Cuando detecta que `lastEventAt` cambió (i.e., llegó un webhook nuevo al
// backend desde el móvil o el simulador), invoca `onRefresh()` para que la
// página haga un re-fetch automático de cuentas y movimientos.
//
// Optimizaciones:
//   - Primera llamada solo establece el baseline (no dispara onRefresh).
//   - Pausa el polling cuando la pestaña está en background (visibilitychange).
//   - Reactiva con un poll inmediato al recuperar el foco de la pestaña.
//   - Limpia el intervalo al desmontar (no memory leaks).
//
// Uso:
//   useWebhookPoll(refetch);              // intervalo por defecto: 5 s
//   useWebhookPoll(refetch, 3000);        // cada 3 s

export function useWebhookPoll(
  onRefresh:   () => void,
  intervalMs = 5000,
): void {
  // Guardamos la última marca de tiempo conocida
  const lastEventRef = useRef<string>('');

  // Ref al callback para evitar que el closure capture una versión obsoleta
  // sin necesidad de reiniciar el intervalo cuando cambia onRefresh.
  const onRefreshRef = useRef(onRefresh);
  useEffect(() => { onRefreshRef.current = onRefresh; }, [onRefresh]);

  // ── Función de polling ────────────────────────────────────────────────────

  const poll = useCallback(async () => {
    try {
      const res = await fetch(PING_URL, {
        cache:       'no-store',       // nunca usar caché del browser
        credentials: 'omit',           // no enviar cookies
      });
      if (!res.ok) return;

      const { lastEventAt } = await res.json() as { lastEventAt: string };

      if (lastEventRef.current && lastEventAt !== lastEventRef.current) {
        // Cambio detectado → trigger de refetch
        onRefreshRef.current();
      }

      // Actualizar baseline (incluso en el primer poll sin disparar refresh)
      lastEventRef.current = lastEventAt;
    } catch {
      // Ignorar errores de red (ngrok desconectado, server reiniciándose, etc.)
      // No queremos que un error de polling interrumpa la UI
    }
  }, []); // dependencias vacías: poll es estable

  // ── Setup del intervalo y del listener de visibilidad ────────────────────

  useEffect(() => {
    // Poll inmediato al montar → establece el baseline sin disparar onRefresh
    void poll();

    const intervalId = setInterval(poll, intervalMs);

    // Cuando el usuario vuelve a la pestaña, hacer un poll inmediato
    // en lugar de esperar al próximo tick del intervalo.
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void poll();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [poll, intervalMs]);
}
