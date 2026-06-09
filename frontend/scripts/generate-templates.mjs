/**
 * generate-templates.mjs
 * ──────────────────────
 * Genera los dos archivos .xlsx de plantillas oficiales de MaIA.
 * Ejecutar con:  node scripts/generate-templates.mjs
 *
 * Requiere: npm install xlsx  (ya instalado como dependencia del proyecto)
 */

import * as XLSX from 'xlsx';
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR   = join(__dirname, '..', 'public', 'templates');

// ─── Colores corporativos ──────────────────────────────────────────────────────
const HEADER_FILL   = { patternType: 'solid', fgColor: { rgb: '10B981' } }; // emerald-500
const EMPRESA_FILL  = { patternType: 'solid', fgColor: { rgb: '7C3AED' } }; // violet-600
const HEADER_FONT   = { bold: true, color: { rgb: 'FFFFFF' }, sz: 11, name: 'Calibri' };
const BODY_FONT     = { sz: 11, name: 'Calibri' };
const EXAMPLE_FILL  = { patternType: 'solid', fgColor: { rgb: 'F0FDF4' } }; // green-50
const EMPRESA_EX    = { patternType: 'solid', fgColor: { rgb: 'F5F3FF' } }; // violet-50
const BORDER        = {
  top:    { style: 'thin', color: { rgb: 'D1FAE5' } },
  bottom: { style: 'thin', color: { rgb: 'D1FAE5' } },
  left:   { style: 'thin', color: { rgb: 'D1FAE5' } },
  right:  { style: 'thin', color: { rgb: 'D1FAE5' } },
};

function cellStyle(fill, font, border) {
  return { fill, font: font || BODY_FONT, border: border || BORDER, alignment: { horizontal: 'left', vertical: 'center' } };
}

// ─── Helper: construir hoja con encabezados + filas de ejemplo ─────────────────
function buildSheet(headers, examples, headerFill, exFill) {
  const ws = {};
  const range = { s: { c: 0, r: 0 }, e: { c: headers.length - 1, r: examples.length } };

  // Fila 0 — encabezados
  headers.forEach((h, c) => {
    const ref = XLSX.utils.encode_cell({ c, r: 0 });
    ws[ref] = {
      v: h,
      t: 's',
      s: cellStyle(headerFill, HEADER_FONT, {
        top:    { style: 'medium', color: { rgb: '047857' } },
        bottom: { style: 'medium', color: { rgb: '047857' } },
        left:   { style: 'medium', color: { rgb: '047857' } },
        right:  { style: 'medium', color: { rgb: '047857' } },
      }),
    };
  });

  // Filas de ejemplo
  examples.forEach((row, r) => {
    row.forEach((val, c) => {
      const ref = XLSX.utils.encode_cell({ c, r: r + 1 });
      ws[ref] = {
        v: val,
        t: typeof val === 'number' ? 'n' : 's',
        s: cellStyle(exFill, BODY_FONT, BORDER),
      };
    });
  });

  ws['!ref'] = XLSX.utils.encode_range(range);

  // Ancho de columnas auto (aprox)
  ws['!cols'] = headers.map(h => ({ wch: Math.max(h.length + 4, 16) }));

  // Altura de fila de encabezado
  ws['!rows'] = [{ hpt: 22 }];

  return ws;
}

// ─── PLANTILLA PERSONAL ────────────────────────────────────────────────────────
const personalHeaders = [
  'Fecha (DD/MM/AAAA)',
  'Descripción/Comercio',
  'Monto',
  'Categoría (Comida, Servicios, Transporte, Gustos)',
  'Cuenta (Nequi, Bancolombia)',
];

const personalExamples = [
  ['15/06/2025', 'Rappi - almuerzo',    45000,  'Comida',      'Nequi'],
  ['16/06/2025', 'Recibo de luz',       85000,  'Servicios',   'Bancolombia'],
  ['17/06/2025', 'TransMilenio x10',    27000,  'Transporte',  'Nequi'],
  ['18/06/2025', 'Netflix mensual',     19900,  'Gustos',      'Bancolombia'],
  ['19/06/2025', 'Mercado Éxito',      220000,  'Comida',      'Bancolombia'],
];

// ─── PLANTILLA EMPRESA ─────────────────────────────────────────────────────────
const empresaHeaders = [
  'Fecha (DD/MM/AAAA)',
  'Cliente/Proveedor',
  'Nro_Factura',
  'Descripción',
  'Subtotal',
  'IVA',
  'Total',
  'Tipo (Ingreso/Egreso)',
];

const empresaExamples = [
  ['15/06/2025', 'Almacenes Éxito S.A.',  'FAC-001', 'Venta producto A',    1000000, 190000, 1190000, 'Ingreso'],
  ['16/06/2025', 'Papelería Central',     'OC-045',  'Compra suministros',   250000,  47500,  297500, 'Egreso'],
  ['17/06/2025', 'Cliente Medellín SAS',  'FAC-002', 'Servicio consultoría', 800000, 152000,  952000, 'Ingreso'],
  ['18/06/2025', 'Proveedor Bogotá Ltda', 'OC-046',  'Materia prima',        500000,  95000,  595000, 'Egreso'],
];

// ─── Generar y guardar ─────────────────────────────────────────────────────────

// Personal
const wbPersonal = XLSX.utils.book_new();
wbPersonal.Props = { Title: 'Plantilla Personal MaIA', Author: 'MaIA' };
const wsPersonal = buildSheet(personalHeaders, personalExamples, HEADER_FILL, EXAMPLE_FILL);
XLSX.utils.book_append_sheet(wbPersonal, wsPersonal, 'Transacciones');
// Hoja de instrucciones
const wsHelp = XLSX.utils.aoa_to_sheet([
  ['📋 INSTRUCCIONES - Plantilla Personal MaIA'],
  [''],
  ['1. No modifiques los nombres de las columnas (fila 1).'],
  ['2. Borra las filas de ejemplo (filas 2 a 6) antes de ingresar tus datos.'],
  ['3. Fecha: formato DD/MM/AAAA (ej: 15/06/2025).'],
  ['4. Monto: número sin puntos de miles ni símbolo $  (ej: 45000).'],
  ['5. Categoría: usa exactamente una de — Comida | Servicios | Transporte | Gustos.'],
  ['6. Cuenta: usa exactamente una de — Nequi | Bancolombia.'],
  ['7. Guarda el archivo como .xlsx antes de subirlo.'],
]);
XLSX.utils.book_append_sheet(wbPersonal, wsHelp, 'Instrucciones');

const outPersonal = join(OUT_DIR, 'plantilla-personal-maia.xlsx');
XLSX.writeFile(wbPersonal, outPersonal, { bookType: 'xlsx', type: 'buffer', cellStyles: true });
console.log('✅ Creado:', outPersonal);

// Empresa
const wbEmpresa = XLSX.utils.book_new();
wbEmpresa.Props = { Title: 'Plantilla Empresa MaIA', Author: 'MaIA' };
const wsEmpresa = buildSheet(empresaHeaders, empresaExamples,
  { patternType: 'solid', fgColor: { rgb: '7C3AED' } },
  { patternType: 'solid', fgColor: { rgb: 'F5F3FF' } });
XLSX.utils.book_append_sheet(wbEmpresa, wsEmpresa, 'Transacciones');

const wsHelpEmp = XLSX.utils.aoa_to_sheet([
  ['📋 INSTRUCCIONES - Plantilla Empresa MaIA'],
  [''],
  ['1. No modifiques los nombres de las columnas (fila 1).'],
  ['2. Borra las filas de ejemplo (filas 2 a 5) antes de ingresar tus datos.'],
  ['3. Fecha: formato DD/MM/AAAA (ej: 15/06/2025).'],
  ['4. Subtotal, IVA, Total: números sin puntos de miles ni símbolo $.'],
  ['5. Tipo: usa exactamente — Ingreso  o  Egreso.'],
  ['6. Nro_Factura: identificador único de tu factura u orden de compra.'],
  ['7. Guarda el archivo como .xlsx antes de subirlo.'],
]);
XLSX.utils.book_append_sheet(wbEmpresa, wsHelpEmp, 'Instrucciones');

const outEmpresa = join(OUT_DIR, 'plantilla-empresa-maia.xlsx');
XLSX.writeFile(wbEmpresa, outEmpresa, { bookType: 'xlsx', type: 'buffer', cellStyles: true });
console.log('✅ Creado:', outEmpresa);

console.log('\n🎉 Plantillas generadas en frontend/public/templates/');
