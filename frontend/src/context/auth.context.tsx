'use client';

// ─── AuthContext ──────────────────────────────────────────────────────────────
//
// Responsabilidades:
//   - Mantener el estado { user, loading } accesible en toda la app.
//   - Hidratar la sesión al arrancar: si hay token en localStorage,
//     verifica si sigue siendo válido llamando a GET /auth/me.
//   - Exponer login(), register(), logout() con lógica de token incluida.
//
// Patrón: Context + Provider. No usamos Zustand ni Redux para este caso
// porque el estado de auth es simple y Next.js App Router ya provee
// un sistema de renderizado que hace innecesaria una store más pesada.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  apiGet,
  apiPost,
  getToken,
  removeToken,
  setToken,
} from '@/lib/api';
import type {
  AuthContextValue,
  AuthResponse,
  LoginPayload,
  RegisterPayload,
  User,
} from '@/types/auth.types';

// ─── Creación del contexto ────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  // loading=true durante la hidratación inicial (evita parpadeo de UI)
  const [loading, setLoading] = useState(true);

  // ── Hidratación al montar ─────────────────────────────────────────────────
  // Al cargar la app, si hay un token guardado, verificamos con el backend
  // que sigue siendo válido (el token podría haber expirado).
  // Esto corre UNA SOLA VEZ gracias al array de dependencias vacío [].

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }

    apiGet<User>('/auth/me')
      .then((userData) => setUser(userData))
      .catch(() => {
        // Token inválido o expirado → limpiamos y dejamos al usuario sin sesión
        removeToken();
      })
      .finally(() => setLoading(false));
  }, []);

  // ── Login ─────────────────────────────────────────────────────────────────

  // ── Helpers de cookie espejo ─────────────────────────────────────────────
  // El middleware Edge no puede leer localStorage, solo cookies.
  // Mantenemos una cookie SameSite=Lax sincronizada con el token
  // para que el middleware pueda hacer redirects server-side.
  const setSessionCookie = (value: string) => {
    document.cookie = `finanzas_session=${value}; path=/; SameSite=Lax; max-age=604800`;
  };
  const clearSessionCookie = () => {
    document.cookie = 'finanzas_session=; path=/; max-age=0';
  };

  const login = useCallback(async (payload: LoginPayload) => {
    const data = await apiPost<AuthResponse>('/auth/login', payload, { public: true });
    setToken(data.accessToken);
    setSessionCookie(data.accessToken);
    setUser(data.user);
    router.push('/dashboard');
  }, [router]);

  // ── Register ──────────────────────────────────────────────────────────────

  const register = useCallback(async (payload: RegisterPayload) => {
    const data = await apiPost<AuthResponse>('/auth/register', payload, { public: true });
    setToken(data.accessToken);
    setSessionCookie(data.accessToken);
    setUser(data.user);
    router.push('/dashboard');
  }, [router]);

  // ── Logout ────────────────────────────────────────────────────────────────

  const logout = useCallback(() => {
    removeToken();
    clearSessionCookie();
    setUser(null);
    router.push('/login');
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook de consumo ──────────────────────────────────────────────────────────
// Centraliza el guardado del contexto y da un error claro si se usa
// fuera del Provider (ayuda a detectar errores en desarrollo).

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  }
  return ctx;
}
