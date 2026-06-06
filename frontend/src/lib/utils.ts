// Utilidad para combinar clases de Tailwind de forma condicional.
// Es una versión minimal de `clsx` + `tailwind-merge` sin dependencias extra.
// Uso: cn('base-class', condition && 'conditional-class', 'otra-clase')
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

// Formatea un número como moneda colombiana
export function formatCurrency(amount: number, currency = 'COP'): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// Formatea una fecha ISO a formato legible
export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date));
}
