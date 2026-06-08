'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/auth.context';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

interface FormErrors {
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

function validate(
  name: string,
  email: string,
  password: string,
  confirmPassword: string,
): FormErrors {
  const errors: FormErrors = {};

  if (name && name.length > 100)
    errors.name = 'El nombre no puede tener más de 100 caracteres';

  if (!email) errors.email = 'El email es obligatorio';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    errors.email = 'Introduce un email válido';

  if (!password) errors.password = 'La contraseña es obligatoria';
  else if (password.length < 8)
    errors.password = 'Mínimo 8 caracteres';
  else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password))
    errors.password = 'Debe tener mayúscula, minúscula y número';

  if (!confirmPassword) errors.confirmPassword = 'Confirma tu contraseña';
  else if (password !== confirmPassword)
    errors.confirmPassword = 'Las contraseñas no coinciden';

  return errors;
}

export default function RegisterPage() {
  const { register } = useAuth();

  const [name, setName]                     = useState('');
  const [email, setEmail]                   = useState('');
  const [password, setPassword]             = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors]                 = useState<FormErrors>({});
  const [apiError, setApiError]             = useState('');
  const [loading, setLoading]               = useState(false);

  // Indicador visual de fuerza de contraseña
  function getPasswordStrength(): { label: string; color: string; width: string } {
    if (password.length === 0) return { label: '', color: '', width: 'w-0' };
    if (password.length < 8)   return { label: 'Débil',   color: 'bg-red-400',    width: 'w-1/4' };
    if (!/(?=.*[A-Z])(?=.*\d)/.test(password))
                                return { label: 'Regular', color: 'bg-amber-400',  width: 'w-2/4' };
    if (password.length < 12)   return { label: 'Buena',   color: 'bg-emerald-400', width: 'w-3/4' };
    return                             { label: 'Fuerte',  color: 'bg-emerald-500', width: 'w-full' };
  }

  const strength = getPasswordStrength();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setApiError('');

    const validationErrors = validate(name, email, password, confirmPassword);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors({});

    setLoading(true);
    try {
      await register({ email, name: name || undefined, password });
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Error al crear la cuenta');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-emerald-50 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center p-4 relative">

      {/* Toggle de tema */}
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md">

        {/* Logo / Marca */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-500 shadow-lg mb-4">
            <span className="text-2xl">💸</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Crea tu cuenta</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
            Empieza a gestionar tus finanzas gratis
          </p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-8">
          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">

            <Input
              label="Nombre (opcional)"
              type="text"
              placeholder="María García"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={errors.name}
              autoComplete="name"
              autoFocus
            />

            <Input
              label="Correo electrónico"
              type="email"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
              autoComplete="email"
            />

            {/* Contraseña con indicador de fuerza */}
            <div className="flex flex-col gap-1.5">
              <Input
                label="Contraseña"
                type="password"
                placeholder="Mín. 8 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={errors.password}
                autoComplete="new-password"
              />
              {password.length > 0 && (
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-300 ${strength.color} ${strength.width}`} />
                  </div>
                  <span className={`text-xs font-medium ${strength.color.replace('bg-', 'text-')}`}>
                    {strength.label}
                  </span>
                </div>
              )}
            </div>

            <Input
              label="Confirmar contraseña"
              type="password"
              placeholder="Repite tu contraseña"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              error={errors.confirmPassword}
              autoComplete="new-password"
            />

            {apiError && (
              <div className="rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
                {apiError}
              </div>
            )}

            <Button type="submit" fullWidth loading={loading}>
              {loading ? 'Creando cuenta...' : 'Crear cuenta gratis'}
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200 dark:border-slate-700" />
            </div>
            <div className="relative flex justify-center text-xs text-slate-400 dark:text-slate-500">
              <span className="bg-white dark:bg-slate-800 px-3">¿Ya tienes cuenta?</span>
            </div>
          </div>

          <Link
            href="/login"
            className="block w-full text-center rounded-lg border border-slate-300 dark:border-slate-600 px-5 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            Iniciar sesión
          </Link>
        </div>

        <p className="text-center text-xs text-slate-400 dark:text-slate-600 mt-6">
          Al registrarte aceptas nuestros términos de uso y política de privacidad.
        </p>
      </div>
    </main>
  );
}
