import Link from 'next/link';
import { cn } from '@/lib/utils';

// ─── Logo NOMI ────────────────────────────────────────────────────────────────
//
// Identidad de marca de NOMI. Dos piezas:
//   <LogoMark>  — isotipo: cuadrado redondeado teal con la "n" en negativo
//   <Logo>      — isotipo + wordmark "nomi" en Sora
//
// El isotipo usa un degradado sutil del teal base (#00796B) hacia su tono
// profundo para dar volumen sin perder sobriedad corporativa.

interface LogoProps {
  /** Tamaño del isotipo en px (el wordmark escala proporcionalmente) */
  size?: number;
  /** Mostrar solo el isotipo (sin texto) */
  markOnly?: boolean;
  /** Ruta al hacer clic. null → no es link */
  href?: string | null;
  className?: string;
}

export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <div
      className={cn(
        'rounded-xl flex items-center justify-center flex-shrink-0 select-none',
        'bg-gradient-to-br from-brand-500 to-brand-800 shadow-sm',
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <span
        className="font-display font-extrabold text-white leading-none"
        style={{ fontSize: size * 0.55, marginTop: -size * 0.02 }}
      >
        n
      </span>
    </div>
  );
}

export function Logo({ size = 32, markOnly = false, href = '/', className }: LogoProps) {
  const content = (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark size={size} />
      {!markOnly && (
        <span
          className="font-display font-bold tracking-[0.02em] text-slate-900 dark:text-white leading-none"
          style={{ fontSize: size * 0.56 }}
        >
          NOMI
        </span>
      )}
    </span>
  );

  if (!href) return content;

  return (
    <Link href={href} aria-label="NOMI — inicio" className="group">
      {content}
    </Link>
  );
}
