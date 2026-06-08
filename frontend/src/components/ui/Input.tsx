import { forwardRef, InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, id, ...props }, ref) => {
    const inputId = id ?? label.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          {label}
        </label>
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'w-full rounded-lg border px-4 py-2.5 text-sm',
            'text-slate-900 dark:text-slate-100',
            'bg-white dark:bg-slate-700',
            'placeholder:text-slate-400 dark:placeholder:text-slate-500',
            'transition-colors duration-150',
            'focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent',
            'dark:focus:ring-emerald-400',
            error
              ? 'border-red-400 dark:border-red-500 focus:ring-red-400'
              : 'border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500',
            className,
          )}
          {...props}
        />
        {error && (
          <p className="text-xs text-red-500 dark:text-red-400 flex items-center gap-1">
            <span aria-hidden>⚠</span> {error}
          </p>
        )}
      </div>
    );
  },
);
Input.displayName = 'Input';

export default Input;
