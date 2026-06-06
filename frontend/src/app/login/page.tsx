'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/auth.context';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';

// ─── Validaciones locales ─────────────────────────────────────────────────────
// Validamos en el cliente para dar feedback inmediato sin esperar al servidor.
// El backend valida de nuevo de forma independiente (defensa en profundidad).

interface FormErrors {
  email?: string;
  password?: string;
}

function validate(email: string, password: string): FormErrors {
  const errors: FormErrors = {};
  if (!email) errors.email = 'El email es obligatorio';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    errors.email = 'Introduce un email válido';
  if (!password) errors.password = 'La contraseña es obligatoria';
  return errors;
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const { login } = useAuth();

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors]     = useState<FormErrors>({});
  const [apiError, setApiError] = useState('');
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setApiError('');

    const validationErrors = validate(email, password);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors({});

    setLoading(true);
    try {
      await login({ email, password });
      // login() llama a router.push('/dashboard') internamente si tiene éxito
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-emerald-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Logo / Marca */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-500 shadow-lg mb-4">
            <span className="text-2xl">💸</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Bienvenido de nuevo</h1>
          <p className="text-slate-500 mt-1 text-sm">Inicia sesión para ver tus finanzas</p>
        </div>

        {/* Card del formulario */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">

            <Input
              label="Correo electrónico"
              type="email"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
              autoComplete="email"
              autoFocus
            />

            <Input
              label="Contraseña"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errors.password}
              autoComplete="current-password"
            />

            {/* Error de API (credenciales incorrectas, servidor caído, etc.) */}
            {apiError && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {apiError}
              </div>
            )}

            <Button type="submit" fullWidth loading={loading}>
              {loading ? 'Iniciando sesión...' : 'Iniciar sesión'}
            </Button>
          </form>

          {/* Separador */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-xs text-slate-400 bg-white px-3">
              ¿No tienes cuenta?
            </div>
          </div>

          <Link
            href="/register"
            className="block w-full text-center rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Crear cuenta gratis
          </Link>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          Tus datos están protegidos con cifrado de extremo a extremo.
        </p>
      </div>
    </main>
  );
}
