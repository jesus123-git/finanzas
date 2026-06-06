// ─── Entidades ────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  name: string | null;
}

// ─── Payloads de peticiones ───────────────────────────────────────────────────

export interface RegisterPayload {
  email: string;
  name?: string;
  password: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

// ─── Respuestas de la API ─────────────────────────────────────────────────────

export interface AuthResponse {
  accessToken: string;
  user: User;
}

// ─── Estado del contexto ──────────────────────────────────────────────────────

export interface AuthContextValue {
  user: User | null;
  loading: boolean;          // true mientras se verifica la sesión al cargar
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => void;
}
