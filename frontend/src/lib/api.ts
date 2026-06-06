// ─── Cliente de API centralizado ─────────────────────────────────────────────
//
// Responsabilidades:
//   1. Prefija todas las peticiones con la URL base del backend.
//   2. Adjunta automáticamente el JWT del localStorage en cada request.
//   3. Normaliza los errores: siempre lanza un Error con mensaje legible.
//   4. Exporta helpers tipados: apiGet, apiPost, apiPatch, apiDelete.

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const API_URL = `${BASE_URL}/api/v1`;

// ─── Helpers de token ─────────────────────────────────────────────────────────

export const TOKEN_KEY = 'finanzas_token';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null; // SSR guard
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

// ─── Core fetch wrapper ───────────────────────────────────────────────────────

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  // Permite pasar headers adicionales por petición
  headers?: Record<string, string>;
  // true → no adjuntar el token (útil para login/register)
  public?: boolean;
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, headers: extraHeaders = {}, public: isPublic = false } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extraHeaders,
  };

  // Adjunta el token en todas las peticiones privadas.
  // Si no hay token y la ruta es privada, el servidor devolverá 401
  // y el interceptor de AuthContext redirigirá al login.
  if (!isPublic) {
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  // Intentamos parsear el body siempre, tanto en éxito como en error.
  // El backend de NestJS devuelve JSON incluso en respuestas de error.
  let data: unknown;
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    data = await response.json();
  }

  if (!response.ok) {
    // NestJS devuelve { message: string | string[], statusCode, error }
    const errorData = data as { message?: string | string[]; error?: string } | undefined;
    const message =
      Array.isArray(errorData?.message)
        ? errorData.message.join('. ')           // class-validator puede devolver array
        : (errorData?.message ?? `Error ${response.status}`);

    const err = new Error(message);
    (err as Error & { status: number }).status = response.status;
    throw err;
  }

  return data as T;
}

// ─── Helpers tipados ──────────────────────────────────────────────────────────

export function apiGet<T>(endpoint: string, opts?: Omit<RequestOptions, 'method' | 'body'>) {
  return request<T>(endpoint, { ...opts, method: 'GET' });
}

export function apiPost<T>(endpoint: string, body: unknown, opts?: Omit<RequestOptions, 'method'>) {
  return request<T>(endpoint, { ...opts, method: 'POST', body });
}

export function apiPatch<T>(endpoint: string, body: unknown, opts?: Omit<RequestOptions, 'method'>) {
  return request<T>(endpoint, { ...opts, method: 'PATCH', body });
}

export function apiDelete<T>(endpoint: string, opts?: Omit<RequestOptions, 'method' | 'body'>) {
  return request<T>(endpoint, { ...opts, method: 'DELETE' });
}
