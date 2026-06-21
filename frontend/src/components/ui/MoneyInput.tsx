'use client';

import { useState, useEffect } from 'react';

// ─── MoneyInput ───────────────────────────────────────────────────────────────
//
// Input de dinero con formato de miles en vivo (es-CO: 89.900).
// Reemplaza a <input type="number"> en campos monetarios: el type number
// rechaza "89.900" porque interpreta el punto como decimal y dispara el
// "Enter a valid value" del navegador.
//
// Internamente mantiene el texto formateado y entrega SIEMPRE un número
// entero limpio vía onChange (los montos en COP no usan centavos).
//
// Uso con react-hook-form:
//   <MoneyInput value={watch('price')} onChange={n => setValue('price', n, { shouldValidate: true })} />

interface Props {
  value:        number | undefined;
  onChange:     (n: number) => void;
  placeholder?: string;
  className?:   string;
  autoFocus?:   boolean;
  disabled?:    boolean;
  /** Símbolo a la izquierda (default: $) */
  symbol?:      string;
}

const format = (n: number): string => n.toLocaleString('es-CO');
const parse  = (raw: string): number => {
  const digits = raw.replace(/[^\d]/g, '');
  return digits ? parseInt(digits, 10) : 0;
};

export function MoneyInput({
  value, onChange, placeholder = '0', className = '', autoFocus, disabled, symbol = '$',
}: Props) {
  const [text, setText] = useState(value ? format(value) : '');

  // Sincronizar cuando el valor cambia desde fuera (reset del formulario, edición)
  useEffect(() => {
    const current = parse(text);
    const next = value ?? 0;
    if (current !== next) setText(next ? format(next) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleChange = (raw: string) => {
    const n = parse(raw);
    setText(n ? format(n) : '');
    onChange(n);
  };

  return (
    <div className="relative">
      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-sm pointer-events-none select-none">
        {symbol}
      </span>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={text}
        onChange={e => handleChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        disabled={disabled}
        className={`pl-9 ${className}`}
      />
    </div>
  );
}
