'use client';

// ─── ExcelImportWizard ────────────────────────────────────────────────────────
//
// Wizard 3 pasos para importar transacciones históricas desde un archivo Excel.
//
// Modos:
//   'personal' — columnas plantilla personal, POST /transactions/bulk
//   'empresa'  — columnas plantilla empresa,  POST /businesses/:id/biz-transactions/bulk
//
// Validación de plantilla oficial: si el archivo subido no coincide con los
// encabezados canónicos de la plantilla correspondiente, se frena el proceso
// y se muestra un aviso amigable con enlace de re-descarga.
//
// Dependencias: xlsx (^0.18.5), react-dropzone (^14.3.5)

import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import * as XLSX from 'xlsx';
import { apiGet, apiPost } from '@/lib/api';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import type { BankAccount } from '@/types/dashboard.types';

// ─── Encabezados canónicos de cada plantilla ─────────────────────────────────
// Deben coincidir EXACTAMENTE (trim) con los headers del archivo subido.

export const PERSONAL_HEADERS = [
  'Fecha (DD/MM/AAAA)',
  'Descripción/Comercio',
  'Monto',
  'Categoría (Comida, Servicios, Transporte, Gustos)',
  'Cuenta (Nequi, Bancolombia)',
] as const;

export const EMPRESA_HEADERS = [
  'Fecha (DD/MM/AAAA)',
  'Cliente/Proveedor',
  'Nro_Factura',
  'Descripción',
  'Subtotal',
  'IVA',
  'Total',
  'Tipo (Ingreso/Egreso)',
] as const;

// ─── Tipos internos ───────────────────────────────────────────────────────────

interface Category { id: string; name: string }

interface ParsedFile {
  filename: string;
  fileSize: number;
  headers:  string[];
  rows:     Record<string, unknown>[];
}

/** Para modo 'personal' */
interface ColumnMapping {
  date:        string;
  description: string;
  amount:      string;
  type:        string;
}

interface ImportRow {
  date:        string;
  description: string;
  amount:      number;
  type:        'INCOME' | 'EXPENSE';
  valid:       boolean;
  error?:      string;
  // extras empresa
  clienteProveedor?: string;
  nroFactura?:       string;
  subtotal?:         number;
  iva?:              number;
}

type WizardStep = 'upload' | 'preview' | 'importing' | 'done';

interface BulkResult {
  inserted:    number;
  accountName: string;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface ExcelImportWizardProps {
  open:        boolean;
  mode:        'personal' | 'empresa';
  accounts?:   BankAccount[];   // requerido en modo personal
  businessId?: string;           // requerido en modo empresa
  onClose:     () => void;
  onSuccess:   () => void;
}

// ─── Helpers de parsing ───────────────────────────────────────────────────────

function parseAmount(raw: unknown): number {
  if (typeof raw === 'number') return Math.abs(raw);
  const s = String(raw ?? '')
    .replace(/\s/g, '')
    .replace(/\$/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  return Math.abs(parseFloat(s) || 0);
}

function parseType(typeRaw: unknown, amountRaw: unknown): 'INCOME' | 'EXPENSE' {
  const s = String(typeRaw ?? '').toLowerCase();
  if (['income', 'ingreso', 'entrada', 'credito', 'crédito', '+'].some(v => s.includes(v))) return 'INCOME';
  if (['expense', 'gasto', 'salida', 'debito', 'débito', 'egreso', '-'].some(v => s.includes(v))) return 'EXPENSE';
  const num = parseFloat(String(amountRaw ?? '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.'));
  return num < 0 ? 'EXPENSE' : 'INCOME';
}

function parseISODate(raw: unknown): string | null {
  if (!raw) return null;
  if (raw instanceof Date) return isNaN(raw.getTime()) ? null : raw.toISOString();
  const s = String(raw).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    const [, dd, mm, yyyy] = m;
    const year = yyyy.length === 2 ? `20${yyyy}` : yyyy;
    const d = new Date(`${year}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Valida que los headers del archivo coincidan exactamente con los de la plantilla.
 * Retorna null si OK, o un mensaje de error si no coincide.
 */
function validateHeaders(fileHeaders: string[], mode: 'personal' | 'empresa'): string | null {
  const canonical = mode === 'personal'
    ? PERSONAL_HEADERS
    : EMPRESA_HEADERS;

  const trimmed = fileHeaders.map(h => h.trim());

  // Verificar que todos los headers canónicos estén presentes
  const missing = canonical.filter(h => !trimmed.includes(h));
  if (missing.length > 0) {
    return `Columnas faltantes: ${missing.map(h => `"${h}"`).join(', ')}`;
  }

  return null; // OK
}

function buildPersonalRows(
  rows: Record<string, unknown>[],
  mapping: ColumnMapping,
): ImportRow[] {
  return rows.map(row => {
    const dateISO = parseISODate(row[mapping.date]);
    const desc    = String(row[mapping.description] ?? '').slice(0, 200).trim();
    const amount  = parseAmount(row[mapping.amount]);
    const type    = parseType(mapping.type ? row[mapping.type] : undefined, row[mapping.amount]);
    let error: string | undefined;
    if (!dateISO)  error = 'Fecha inválida';
    else if (!desc) error = 'Descripción vacía';
    else if (amount <= 0) error = 'Monto ≤ 0';
    return { date: dateISO ?? '', description: desc || '(sin descripción)', amount, type, valid: !error, error };
  }).filter(r => r.date || r.description !== '(sin descripción)');
}

function buildEmpresaRows(rows: Record<string, unknown>[]): ImportRow[] {
  const H = EMPRESA_HEADERS;
  return rows.map(row => {
    const dateISO        = parseISODate(row[H[0]]);
    const clienteProv    = String(row[H[1]] ?? '').trim();
    const nroFactura     = String(row[H[2]] ?? '').trim();
    const descripcion    = String(row[H[3]] ?? '').trim();
    const subtotal       = parseAmount(row[H[4]]);
    const iva            = parseAmount(row[H[5]]);
    const total          = parseAmount(row[H[6]]);
    const tipo           = parseType(row[H[7]], row[H[6]]);
    const description    = `[${nroFactura || '—'}] ${clienteProv || '—'} — ${descripcion || '—'}`.slice(0, 250);
    let error: string | undefined;
    if (!dateISO)           error = 'Fecha inválida';
    else if (!clienteProv)  error = 'Cliente/Proveedor vacío';
    else if (total <= 0)    error = 'Total ≤ 0';
    return {
      date: dateISO ?? '', description, amount: total, type: tipo,
      valid: !error, error,
      clienteProveedor: clienteProv, nroFactura, subtotal, iva,
    };
  }).filter(r => r.date || r.clienteProveedor);
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function ExcelImportWizard({
  open, mode, accounts = [], businessId, onClose, onSuccess,
}: ExcelImportWizardProps) {
  const isEmpresa = mode === 'empresa';
  const accentCls = isEmpresa ? 'violet' : 'emerald';

  const [step,           setStep]          = useState<WizardStep>('upload');
  const [parsedFile,     setParsedFile]    = useState<ParsedFile | null>(null);
  const [mapping,        setMapping]       = useState<ColumnMapping>({ date: '', description: '', amount: '', type: '' });
  const [accountId,      setAccountId]     = useState(accounts[0]?.id ?? '');
  const [categoryId,     setCategoryId]    = useState('');
  const [categories,     setCategories]    = useState<Category[]>([]);
  const [importRows,     setImportRows]    = useState<ImportRow[]>([]);
  const [parseError,     setParseError]    = useState<string | null>(null);
  const [headerError,    setHeaderError]   = useState<string | null>(null);
  const [result,         setResult]        = useState<BulkResult | null>(null);
  const [importError,    setImportError]   = useState<string | null>(null);

  const templatePath  = `/templates/plantilla-${mode}-maia.xlsx`;
  const templateLabel = isEmpresa ? 'Empresa' : 'Personal';
  const canonical     = isEmpresa ? EMPRESA_HEADERS : PERSONAL_HEADERS;

  useEffect(() => {
    if (!open || isEmpresa) return;
    apiGet<Category[]>('/categories').then(setCategories).catch(() => setCategories([]));
  }, [open, isEmpresa]);

  useEffect(() => {
    if (categories.length > 0 && !categoryId) setCategoryId(categories[0].id);
  }, [categories, categoryId]);

  useEffect(() => {
    if (!open) {
      setStep('upload');
      setParsedFile(null);
      setMapping({ date: '', description: '', amount: '', type: '' });
      setParseError(null);
      setHeaderError(null);
      setResult(null);
      setImportError(null);
      setImportRows([]);
    }
  }, [open]);

  // Recalcular filas al cambiar mapeo (solo modo personal)
  useEffect(() => {
    if (isEmpresa || !parsedFile || !mapping.date || !mapping.description || !mapping.amount) {
      if (!isEmpresa) setImportRows([]);
      return;
    }
    setImportRows(buildPersonalRows(parsedFile.rows, mapping));
  }, [parsedFile, mapping, isEmpresa]);

  // ── Drag & Drop ──────────────────────────────────────────────────────────────
  const onDrop = useCallback(async (accepted: File[]) => {
    const file = accepted[0];
    if (!file) return;
    setParseError(null);
    setHeaderError(null);

    try {
      const buffer = await file.arrayBuffer();
      const wb     = XLSX.read(buffer, { type: 'array', cellDates: true });
      const sheet  = wb.Sheets[wb.SheetNames[0]];
      const raw    = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, dateNF: 'yyyy-mm-dd' });

      if (!raw.length) { setParseError('El archivo está vacío'); return; }

      const headers: string[] = (raw[0] as unknown[]).map(h => String(h ?? '').trim());
      const dataRows = (raw as unknown[][])
        .slice(1)
        .filter(row => row.some(cell => cell !== '' && cell != null))
        .map(row => {
          const obj: Record<string, unknown> = {};
          headers.forEach((h, i) => { obj[h] = row[i] ?? ''; });
          return obj;
        });

      if (!dataRows.length) { setParseError('El archivo no tiene filas de datos'); return; }

      // ── Validación estricta de plantilla oficial ─────────────────────────────
      const validErr = validateHeaders(headers, mode);
      if (validErr) {
        setHeaderError(validErr);
        return; // frenar aquí — no avanzar al paso 2
      }

      const parsed: ParsedFile = { filename: file.name, fileSize: file.size, headers, rows: dataRows };
      setParsedFile(parsed);

      if (isEmpresa) {
        setImportRows(buildEmpresaRows(dataRows));
        setStep('preview');
      } else {
        // Auto-detectar columnas personales usando los headers canónicos
        const auto: ColumnMapping = {
          date:        canonical[0] as string,
          description: canonical[1] as string,
          amount:      canonical[2] as string,
          type:        '',
        };
        setMapping(auto);
        setStep('preview');
      }
    } catch {
      setParseError('No se pudo leer el archivo. Verifica que sea un Excel o CSV válido.');
    }
  }, [mode, isEmpresa, canonical]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv'],
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
  });

  // ── Enviar importación ──────────────────────────────────────────────────────
  const handleImport = useCallback(async () => {
    const validRows = importRows.filter(r => r.valid);
    if (!validRows.length) return;

    setStep('importing');
    setImportError(null);
    try {
      let res: BulkResult;
      if (isEmpresa) {
        res = await apiPost<BulkResult>(`/businesses/${businessId}/biz-transactions/bulk`, {
          rows: validRows.map(r => ({
            date:             r.date,
            description:      r.description,
            amount:           r.amount,
            type:             r.type,
            clienteProveedor: r.clienteProveedor,
            nroFactura:       r.nroFactura,
            subtotal:         r.subtotal,
            iva:              r.iva,
          })),
        });
      } else {
        if (!accountId || !categoryId) { setStep('preview'); return; }
        res = await apiPost<BulkResult>('/transactions/bulk', {
          bankAccountId: accountId,
          categoryId,
          rows: validRows.map(r => ({
            date:        r.date,
            description: r.description,
            amount:      r.amount,
            type:        r.type,
          })),
        });
      }
      setResult(res);
      setStep('done');
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Error al importar');
      setStep('preview');
    }
  }, [importRows, isEmpresa, businessId, accountId, categoryId]);

  if (!open) return null;

  const validCount   = importRows.filter(r => r.valid).length;
  const invalidCount = importRows.length - validCount;
  const canImport    = validCount > 0 && (isEmpresa || (!!accountId && !!categoryId));

  // Colores de acento dinámicos según modo
  const ringColor  = isEmpresa ? 'focus:ring-violet-400'  : 'focus:ring-emerald-400';
  const btnActive  = isEmpresa
    ? 'bg-violet-600 hover:bg-violet-700'
    : 'bg-emerald-500 hover:bg-emerald-600';
  const stepActive = isEmpresa ? 'bg-violet-600' : 'bg-emerald-500';
  const stepDone   = isEmpresa ? 'bg-violet-500' : 'bg-emerald-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-slate-950/50 dark:bg-slate-950/70 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />

      {/* Panel */}
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-700 flex flex-col max-h-[90vh] animate-fade-up">

        {/* ── Cabecera ──────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl" aria-hidden>{isEmpresa ? '🏢' : '💸'}</span>
            <div>
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
                Importar desde Excel — {templateLabel}
              </h2>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                {step === 'upload'    && 'Usa la plantilla oficial · sube el archivo para comenzar'}
                {step === 'preview'   && `${parsedFile?.rows.length ?? 0} filas detectadas — revisa y confirma`}
                {step === 'importing' && 'Importando transacciones…'}
                {step === 'done'      && `¡Listo! ${result?.inserted ?? 0} transacciones importadas`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            aria-label="Cerrar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Indicador de pasos ─────────────────────────────────────── */}
        <div className="flex items-center gap-0 px-6 py-3 border-b border-slate-100 dark:border-slate-700 flex-shrink-0">
          {(['upload', 'preview', 'done'] as const).map((s, i) => {
            const labels = ['Subir archivo', 'Configurar', 'Resultado'];
            const active = step === s || (step === 'importing' && s === 'done');
            const done   = (step === 'preview' && i === 0) ||
                           (step === 'importing' && i < 2) ||
                           (step === 'done' && i < 2);
            return (
              <div key={s} className="flex items-center">
                <div className="flex items-center gap-1.5">
                  <div className={cn(
                    'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors',
                    done   ? stepDone + ' text-white' : '',
                    active && !done ? stepActive + ' text-white' : '',
                    !active && !done ? 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500' : '',
                  )}>
                    {done ? '✓' : i + 1}
                  </div>
                  <span className={cn(
                    'text-xs font-medium hidden sm:block',
                    active || done ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400 dark:text-slate-500',
                  )}>
                    {labels[i]}
                  </span>
                </div>
                {i < 2 && (
                  <div className={cn(
                    'w-8 h-px mx-2',
                    done ? (isEmpresa ? 'bg-violet-400' : 'bg-emerald-400') : 'bg-slate-200 dark:bg-slate-700',
                  )} />
                )}
              </div>
            );
          })}
        </div>

        {/* ── Contenido scrolleable ──────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* ══ PASO 1: Upload ══════════════════════════════════════════ */}
          {step === 'upload' && (
            <div className="space-y-4">

              {/* Botón descarga plantilla oficial */}
              <div className={cn(
                'flex items-center justify-between rounded-2xl px-5 py-4 border',
                isEmpresa
                  ? 'bg-violet-50 dark:bg-violet-950/20 border-violet-200 dark:border-violet-800'
                  : 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800',
              )}>
                <div>
                  <p className={cn(
                    'text-sm font-bold',
                    isEmpresa ? 'text-violet-700 dark:text-violet-300' : 'text-emerald-700 dark:text-emerald-300',
                  )}>
                    📥 Plantilla Oficial MaIA {templateLabel}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Solo se aceptan archivos con exactamente estas columnas:
                  </p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 font-mono">
                    {canonical.join(' | ')}
                  </p>
                </div>
                <a
                  href={templatePath}
                  download
                  className={cn(
                    'flex-shrink-0 ml-4 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white shadow-sm transition-all active:scale-95',
                    isEmpresa
                      ? 'bg-violet-600 hover:bg-violet-700'
                      : 'bg-emerald-500 hover:bg-emerald-600',
                  )}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Descargar
                </a>
              </div>

              {/* Dropzone */}
              <div
                {...getRootProps()}
                className={cn(
                  'border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-200',
                  isDragActive
                    ? isEmpresa
                      ? 'border-violet-400 bg-violet-50 dark:bg-violet-950/20 scale-[1.01]'
                      : 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 scale-[1.01]'
                    : isEmpresa
                      ? 'border-slate-200 dark:border-slate-600 hover:border-violet-300 hover:bg-violet-50/50 dark:hover:bg-violet-950/10'
                      : 'border-slate-200 dark:border-slate-600 hover:border-emerald-300 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/10',
                )}
              >
                <input {...getInputProps()} />
                <div className="text-4xl mb-3 select-none" aria-hidden>📂</div>
                <p className="text-base font-semibold text-slate-700 dark:text-slate-200">
                  {isDragActive ? 'Suelta el archivo aquí' : 'Arrastra tu archivo aquí'}
                </p>
                <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                  o haz clic para seleccionar
                </p>
                <p className="text-xs text-slate-300 dark:text-slate-600 mt-3">
                  .xlsx · .xls · .csv · máx 10 MB
                </p>
              </div>

              {/* Error de headers (plantilla incorrecta) */}
              {headerError && (
                <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-5 py-4">
                  <p className="text-sm font-bold text-amber-800 dark:text-amber-300 mb-1">
                    ¡Ups! El archivo no coincide con la plantilla oficial de MaIA {templateLabel}
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-400 mb-3">
                    {headerError}
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-500 mb-3">
                    Por favor descarga la plantilla, rellénala con tus datos y vuelve a subirla.
                  </p>
                  <a
                    href={templatePath}
                    download
                    className={cn(
                      'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white',
                      isEmpresa ? 'bg-violet-600 hover:bg-violet-700' : 'bg-emerald-500 hover:bg-emerald-600',
                    )}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Descargar plantilla oficial
                  </a>
                </div>
              )}

              {/* Error de parse */}
              {parseError && (
                <div className="rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
                  ⚠️ {parseError}
                </div>
              )}
            </div>
          )}

          {/* ══ PASO 2: Preview ══════════════════════════════════════════ */}
          {step === 'preview' && parsedFile && (
            <div className="space-y-5">

              {/* Resumen del archivo */}
              <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700/40 rounded-xl border border-slate-100 dark:border-slate-700">
                <span className="text-2xl" aria-hidden>📊</span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{parsedFile.filename}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    {fmtSize(parsedFile.fileSize)} · {parsedFile.rows.length} filas · {parsedFile.headers.length} columnas
                  </p>
                </div>
                <button
                  onClick={() => { setParsedFile(null); setHeaderError(null); setStep('upload'); }}
                  className="ml-auto text-xs text-slate-400 hover:text-rose-500 transition-colors flex-shrink-0 px-2 py-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20"
                >
                  Cambiar
                </button>
              </div>

              {/* Selectores de cuenta y categoría — solo modo personal */}
              {!isEmpresa && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                      Cuenta destino <span className="text-red-400">*</span>
                    </label>
                    <select
                      value={accountId}
                      onChange={e => setAccountId(e.target.value)}
                      className={cn('w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2', ringColor)}
                    >
                      {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                      Categoría <span className="text-red-400">*</span>
                    </label>
                    <select
                      value={categoryId}
                      onChange={e => setCategoryId(e.target.value)}
                      className={cn('w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2', ringColor)}
                    >
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      {categories.length === 0 && <option value="" disabled>Sin categorías — crea una primero</option>}
                    </select>
                  </div>
                </div>
              )}

              {/* Mapeo de columnas — solo modo personal */}
              {!isEmpresa && (
                <div>
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">Mapeo de columnas</p>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        { key: 'date',        label: 'Fecha',       required: true  },
                        { key: 'description', label: 'Descripción', required: true  },
                        { key: 'amount',      label: 'Monto',       required: true  },
                        { key: 'type',        label: 'Tipo',        required: false },
                      ] as const
                    ).map(({ key, label, required }) => (
                      <div key={key}>
                        <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                          {label}{required && <span className="text-red-400 ml-0.5">*</span>}
                          {!required && <span className="text-slate-300 dark:text-slate-600 ml-1">(opcional)</span>}
                        </label>
                        <select
                          value={mapping[key]}
                          onChange={e => setMapping(prev => ({ ...prev, [key]: e.target.value }))}
                          className={cn('w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2', ringColor)}
                        >
                          {!required && <option value="">— No usar —</option>}
                          {required   && <option value="">— Seleccionar —</option>}
                          {parsedFile.headers.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Preview de filas */}
              {importRows.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                      Vista previa (primeras 5 filas)
                    </p>
                    <div className="flex gap-2 text-xs">
                      {validCount > 0 && (
                        <span className={cn('font-medium', isEmpresa ? 'text-violet-600 dark:text-violet-400' : 'text-emerald-600 dark:text-emerald-400')}>
                          ✓ {validCount} válidas
                        </span>
                      )}
                      {invalidCount > 0 && (
                        <span className="text-rose-500 dark:text-rose-400 font-medium">
                          ✗ {invalidCount} con error
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-700">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-700/50">
                          <th className="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">Fecha</th>
                          {isEmpresa && <th className="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">Factura / Cliente</th>}
                          {!isEmpresa && <th className="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">Descripción</th>}
                          <th className="px-3 py-2 text-right font-semibold text-slate-500 dark:text-slate-400">Total</th>
                          <th className="px-3 py-2 text-center font-semibold text-slate-500 dark:text-slate-400">Tipo</th>
                          <th className="px-3 py-2 text-center font-semibold text-slate-500 dark:text-slate-400">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {importRows.slice(0, 5).map((row, i) => (
                          <tr key={i} className={cn(!row.valid && 'bg-rose-50/60 dark:bg-rose-950/20')}>
                            <td className="px-3 py-1.5 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                              {row.date ? formatDate(row.date) : '—'}
                            </td>
                            <td className="px-3 py-1.5 text-slate-700 dark:text-slate-300 max-w-[180px] truncate">
                              {isEmpresa
                                ? <><span className="font-mono text-[10px] text-slate-400">{row.nroFactura}</span> {row.clienteProveedor}</>
                                : row.description
                              }
                            </td>
                            <td className={cn(
                              'px-3 py-1.5 text-right font-semibold whitespace-nowrap',
                              row.type === 'INCOME'
                                ? isEmpresa ? 'text-violet-600 dark:text-violet-400' : 'text-emerald-600 dark:text-emerald-400'
                                : 'text-rose-500 dark:text-rose-400',
                            )}>
                              {row.amount > 0 ? formatCurrency(row.amount) : '—'}
                            </td>
                            <td className="px-3 py-1.5 text-center">
                              <span className={cn(
                                'text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
                                row.type === 'INCOME'
                                  ? isEmpresa
                                    ? 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-400'
                                    : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400'
                                  : 'bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400',
                              )}>
                                {row.type === 'INCOME' ? 'Ingreso' : 'Egreso'}
                              </span>
                            </td>
                            <td className="px-3 py-1.5 text-center">
                              {row.valid
                                ? <span className="text-emerald-500 text-sm">✓</span>
                                : <span className="text-rose-400 text-[10px]" title={row.error}>✗ {row.error}</span>
                              }
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {importRows.length > 5 && (
                      <p className="px-3 py-2 text-[11px] text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-700/30 border-t border-slate-100 dark:border-slate-700">
                        … y {importRows.length - 5} filas más
                      </p>
                    )}
                  </div>
                </div>
              )}

              {importError && (
                <div className="rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
                  ⚠️ {importError}
                </div>
              )}
            </div>
          )}

          {/* ══ Importando ══════════════════════════════════════════════ */}
          {step === 'importing' && (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-4">
              <div className={cn(
                'w-14 h-14 rounded-2xl flex items-center justify-center',
                isEmpresa ? 'bg-violet-100 dark:bg-violet-900/40' : 'bg-emerald-100 dark:bg-emerald-900/40',
              )}>
                <svg xmlns="http://www.w3.org/2000/svg" className={cn('h-7 w-7 animate-spin', isEmpresa ? 'text-violet-500' : 'text-emerald-500')} fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
              <div>
                <p className="text-base font-semibold text-slate-800 dark:text-slate-100">Importando {validCount} transacciones…</p>
                <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">Esto puede tomar unos segundos</p>
              </div>
            </div>
          )}

          {/* ══ PASO 3: Resultado ════════════════════════════════════════ */}
          {step === 'done' && result && (
            <div className="flex flex-col items-center justify-center py-10 text-center gap-5">
              <div className={cn(
                'w-16 h-16 rounded-2xl flex items-center justify-center',
                isEmpresa ? 'bg-violet-100 dark:bg-violet-900/40' : 'bg-emerald-100 dark:bg-emerald-900/40',
              )}>
                <span className="text-3xl" aria-hidden>🎉</span>
              </div>
              <div>
                <p className="text-xl font-bold text-slate-800 dark:text-slate-100">¡Importación exitosa!</p>
                <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm leading-relaxed">
                  Se importaron <span className={cn('font-bold', isEmpresa ? 'text-violet-600 dark:text-violet-400' : 'text-emerald-600 dark:text-emerald-400')}>{result.inserted} transacciones</span>
                  {result.accountName && (
                    <> a la cuenta <span className="font-semibold text-slate-700 dark:text-slate-200">{result.accountName}</span></>
                  )}
                </p>
                {invalidCount > 0 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                    {invalidCount} filas omitidas por errores de formato
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 dark:border-slate-700 flex-shrink-0">
          {step === 'upload' && (
            <>
              <div />
              <button
                onClick={onClose}
                className="text-sm font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 px-4 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                Cancelar
              </button>
            </>
          )}

          {step === 'preview' && (
            <>
              <button
                onClick={() => setStep('upload')}
                className="text-sm font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 px-4 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                ← Atrás
              </button>
              <button
                onClick={handleImport}
                disabled={!canImport}
                className={cn(
                  'px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all shadow-sm',
                  canImport
                    ? btnActive + ' active:scale-95'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed',
                )}
              >
                Importar {validCount} transacciones
              </button>
            </>
          )}

          {step === 'done' && (
            <>
              <div />
              <button
                onClick={() => { onSuccess(); onClose(); }}
                className={cn(
                  'px-5 py-2.5 rounded-xl text-sm font-bold text-white active:scale-95 transition-all shadow-sm',
                  btnActive,
                )}
              >
                {isEmpresa ? 'Ver empresa →' : 'Ver dashboard →'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
