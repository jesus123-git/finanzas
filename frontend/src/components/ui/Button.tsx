import { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
  fullWidth?: boolean;
}

const variantClasses: Record<Variant, string> = {
  // Teal NOMI sólido — el único acento fuerte de la interfaz
  primary:
    'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 ' +
    'shadow-sm shadow-brand-600/20 focus:ring-brand-500 ' +
    'dark:bg-brand-600 dark:hover:bg-brand-500',
  ghost:
    'bg-transparent text-slate-600 dark:text-slate-300 ' +
    'hover:bg-slate-100 dark:hover:bg-slate-800 ' +
    'focus:ring-slate-400 dark:focus:ring-slate-500',
  danger:
    'bg-red-500 text-white hover:bg-red-600 focus:ring-red-500 ' +
    'dark:bg-red-600 dark:hover:bg-red-500',
};

export default function Button({
  children,
  variant = 'primary',
  loading = false,
  fullWidth = false,
  className,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled ?? loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5',
        'text-sm font-semibold transition-all duration-150',
        'focus:outline-none focus:ring-2 focus:ring-offset-2',
        'dark:focus:ring-offset-slate-900',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variantClasses[variant],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    >
      {loading && (
        <svg
          className="h-4 w-4 animate-spin"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      )}
      {children}
    </button>
  );
}
