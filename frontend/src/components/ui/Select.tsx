import { forwardRef, SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface Option { value: string; label: string }

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: Option[];
  placeholder?: string;
  error?: string;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, options, placeholder, error, className, id, ...props }, ref) => {
    const selectId = id ?? label.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={selectId}
          className="text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          {label}
        </label>
        <select
          ref={ref}
          id={selectId}
          className={cn(
            'w-full rounded-lg border px-4 py-2.5 text-sm',
            'bg-white dark:bg-slate-700',
            'text-slate-900 dark:text-slate-100',
            'transition-colors duration-150 appearance-none cursor-pointer',
            'focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent',
            'dark:focus:ring-emerald-400',
            error
              ? 'border-red-400 dark:border-red-500 focus:ring-red-400'
              : 'border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500',
            className,
          )}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && (
          <p className="text-xs text-red-500 dark:text-red-400 flex items-center gap-1">
            <span aria-hidden>⚠</span> {error}
          </p>
        )}
      </div>
    );
  },
);
Select.displayName = 'Select';
export default Select;
