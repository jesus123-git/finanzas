'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/auth.context';
import { GoogleSignInButton } from '@/components/ui/GoogleSignInButton';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { LogoMark } from '@/components/ui/Logo';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

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
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-emerald-50 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center p-4 relative">

      {/* Toggle de tema — esquina superior derecha */}
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex justify-center mb-4">
            <LogoMark size={56} />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Bienvenido de nuevo</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">Inicia sesión en tu espacio NOMI</p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-8">
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

            {apiError && (
              <div className="rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
                {apiError}
              </div>
            )}

            <Button type="submit" fullWidth loading={loading}>
              {loading ? 'Iniciando sesión...' : 'Iniciar sesión'}
            </Button>
          </form>

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200 dark:border-slate-700" />
            </div>
            <div className="relative flex justify-center text-xs text-slate-400 dark:text-slate-500">
              <span className="bg-white dark:bg-slate-800 px-3">o</span>
            </div>
          </div>

          <GoogleSignInButton text="signin_with" />

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200 dark:border-slate-700" />
            </div>
            <div className="relative flex justify-center text-xs text-slate-400 dark:text-slate-500">
              <span className="bg-white dark:bg-slate-800 px-3">¿No tienes cuenta?</span>
            </div>
          </div>

          <Link
            href="/register"
            className="block w-full text-center rounded-lg border border-slate-300 dark:border-slate-600 px-5 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            Crear cuenta gratis
          </Link>
        </div>

        <p className="text-center text-xs text-slate-400 dark:text-slate-600 mt-6">
          Tus datos están protegidos con cifrado de extremo a extremo.
        </p>
      </div>
    </main>
  );
}
