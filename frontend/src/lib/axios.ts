/**
 * Instancia de Axios configurada para el backend de MaIA.
 * Compatibilidad con las páginas del módulo empresarial que usan `api.get/post/patch/delete`.
 *
 * IMPORTANTE: usa la MISMA clave de token que lib/api.ts (getToken/removeToken).
 * Tener dos claves distintas ('token' vs 'finanzas_token') causaba que todas
 * las páginas de empresa enviaran requests sin JWT → 401 → redirect en cadena
 * /login → /dashboard → /personal.
 */

import axios from 'axios';
import { getToken, removeToken } from './api';
import { removeSessionCookie } from './cookies';
import { upgradeModalBus } from './upgradeModalBus';

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL
    ? `${process.env.NEXT_PUBLIC_API_URL}/api/v1`
    : 'http://localhost:3001/api/v1';

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// ─── Request interceptor: inyectar JWT ────────────────────────────────────────
api.interceptors.request.use(config => {
  if (typeof window !== 'undefined') {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

const UPGRADE_ERRORS = new Set([
  'INVOICE_LIMIT_REACHED', 'CLIENT_LIMIT_REACHED', 'PRODUCT_LIMIT_REACHED',
  'QUOTE_LIMIT_REACHED',   'SUPPLIER_LIMIT_REACHED', 'BUSINESS_LIMIT_REACHED',
  'MEMBER_LIMIT_REACHED',  'FEATURE_NOT_AVAILABLE',
]);

// ─── Response interceptor: manejar 401 y límites de plan ─────────────────────
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      // Limpiar token Y cookie espejo: si la cookie queda viva, el middleware
      // rebota /login → /dashboard → /personal en un loop confuso
      removeToken();
      removeSessionCookie();
      window.location.href = '/login';
    }
    const code: string = error.response?.data?.message ?? '';
    if (UPGRADE_ERRORS.has(code)) {
      upgradeModalBus.emit(code);
    }
    return Promise.reject(error);
  },
);

export default api;
