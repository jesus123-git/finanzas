// ─── Catálogo de monedas LATAM ────────────────────────────────────────────────
//
// Fuente única de verdad para los selectores de moneda y el formateo.
// `decimals: 0` para monedas que no usan centavos en la práctica (COP, CLP, PYG).

export interface Currency {
  code:     string;
  name:     string;
  country:  string;
  locale:   string;
  decimals: 0 | 2;
}

export const CURRENCIES: Currency[] = [
  { code: 'COP', name: 'Peso colombiano',      country: 'Colombia',        locale: 'es-CO', decimals: 0 },
  { code: 'MXN', name: 'Peso mexicano',        country: 'México',          locale: 'es-MX', decimals: 2 },
  { code: 'ARS', name: 'Peso argentino',       country: 'Argentina',       locale: 'es-AR', decimals: 2 },
  { code: 'CLP', name: 'Peso chileno',         country: 'Chile',           locale: 'es-CL', decimals: 0 },
  { code: 'PEN', name: 'Sol peruano',          country: 'Perú',            locale: 'es-PE', decimals: 2 },
  { code: 'BRL', name: 'Real brasileño',       country: 'Brasil',          locale: 'pt-BR', decimals: 2 },
  { code: 'UYU', name: 'Peso uruguayo',        country: 'Uruguay',         locale: 'es-UY', decimals: 2 },
  { code: 'BOB', name: 'Boliviano',            country: 'Bolivia',         locale: 'es-BO', decimals: 2 },
  { code: 'PYG', name: 'Guaraní',              country: 'Paraguay',        locale: 'es-PY', decimals: 0 },
  { code: 'GTQ', name: 'Quetzal',              country: 'Guatemala',       locale: 'es-GT', decimals: 2 },
  { code: 'DOP', name: 'Peso dominicano',      country: 'Rep. Dominicana', locale: 'es-DO', decimals: 2 },
  { code: 'USD', name: 'Dólar estadounidense', country: 'EE. UU.',         locale: 'en-US', decimals: 2 },
];

export const getCurrency = (code: string): Currency =>
  CURRENCIES.find(c => c.code === code) ?? CURRENCIES[0];

/** Opciones listas para un <select>: "COP — Peso colombiano (Colombia)" */
export const currencyOptions = CURRENCIES.map(c => ({
  value: c.code,
  label: `${c.code} — ${c.name}`,
}));
