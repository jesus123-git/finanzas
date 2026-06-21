import { getCurrency } from './currencies';
// Utilidad para combinar clases de Tailwind de forma condicional.
// Es una versión minimal de `clsx` + `tailwind-merge` sin dependencias extra.
// Uso: cn('base-class', condition && 'conditional-class', 'otra-clase')
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

// Formatea un número como moneda colombiana
export function formatCurrency(amount: number, currency = 'COP'): string {
  const meta = getCurrency(currency);
  return new Intl.NumberFormat(meta.locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: meta.decimals,
    maximumFractionDigits: meta.decimals,
  }).format(amount);
}

// Formatea una fecha ISO a formato legible (sin hora)
export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('es-CO', {
    year:  'numeric',
    month: 'short',
    day:   'numeric',
  }).format(new Date(date));
}

// Formatea fecha + hora para Colombia (p. ej: "5 jun. 2026, 3:47 p. m.")
// Solo se usa en componentes client — sin riesgo de hidratación.
export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat('es-CO', {
    year:   'numeric',
    month:  'short',
    day:    'numeric',
    hour:   '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}
