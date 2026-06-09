/**
 * generate-templates.cjs  —  CommonJS para ejecutar en el contenedor Docker
 * Uso:  node /app/scripts/generate-templates.cjs
 */
'use strict';

const XLSX = require('xlsx');
const fs   = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'public', 'templates');
fs.mkdirSync(OUT_DIR, { recursive: true });

// ─── Helpers de estilo ────────────────────────────────────────────────────────
function hCell(value, rgb) {
  return {
    v: value, t: 's',
    s: {
      fill:      { patternType: 'solid', fgColor: { rgb } },
      font:      { bold: true, color: { rgb: 'FFFFFF' }, sz: 11, name: 'Calibri' },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: {
        top:    { style: 'medium', color: { rgb: '047857' } },
        bottom: { style: 'medium', color: { rgb: '047857' } },
        left:   { style: 'medium', color: { rgb: '047857' } },
        right:  { style: 'medium', color: { rgb: '047857' } },
      },
    },
  };
}

function bCell(value, fill) {
  const t = typeof value === 'number' ? 'n' : 's';
  return {
    v: value, t,
    s: {
      fill:      { patternType: 'solid', fgColor: { rgb: fill } },
      font:      { sz: 11, name: 'Calibri' },
      alignment: { horizontal: 'left', vertical: 'center' },
      border: {
        top:    { style: 'thin', color: { rgb: 'D1FAE5' } },
        bottom: { style: 'thin', color: { rgb: 'D1FAE5' } },
        left:   { style: 'thin', color: { rgb: 'D1FAE5' } },
        right:  { style: 'thin', color: { rgb: 'D1FAE5' } },
      },
    },
  };
}

function buildSheet(headers, examples, headerRgb, exFillRgb) {
  const ws = {};
  const R  = 1 + examples.length;
  const C  = headers.length;

  // Encabezados (fila 0)
  headers.forEach((h, c) => {
    ws[XLSX.utils.encode_cell({ c, r: 0 })] = hCell(h, headerRgb);
  });

  // Filas de ejemplo
  examples.forEach((row, ri) => {
    row.forEach((val, c) => {
      ws[XLSX.utils.encode_cell({ c, r: ri + 1 })] = bCell(val, exFillRgb);
    });
  });

  ws['!ref']  = XLSX.utils.encode_range({ s: { c: 0, r: 0 }, e: { c: C - 1, r: R } });
  ws['!cols'] = headers.map(h => ({ wch: Math.max(h.length + 4, 18) }));
  ws['!rows'] = [{ hpt: 28 }]; // encabezado más alto

  return ws;
}

// ─── PLANTILLA PERSONAL ───────────────────────────────────────────────────────
const PERSONAL_HEADERS = [
  'Fecha (DD/MM/AAAA)',
  'Descripción/Comercio',
  'Monto',
  'Categoría (Comida, Servicios, Transporte, Gustos)',
  'Cuenta (Nequi, Bancolombia)',
];

const PERSONAL_EXAMPLES = [
  ['15/06/2025', 'Rappi - almuerzo',    45000,  'Comida',     'Nequi'],
  ['16/06/2025', 'Recibo de luz',       85000,  'Servicios',  'Bancolombia'],
  ['17/06/2025', 'TransMilenio x10',    27000,  'Transporte', 'Nequi'],
  ['18/06/2025', 'Netflix mensual',     19900,  'Gustos',     'Bancolombia'],
  ['19/06/2025', 'Mercado Éxito',      220000,  'Comida',     'Bancolombia'],
];

const wbPersonal = XLSX.utils.book_new();
wbPersonal.Props = { Title: 'Plantilla Personal MaIA', Author: 'MaIA' };

XLSX.utils.book_append_sheet(
  wbPersonal,
  buildSheet(PERSONAL_HEADERS, PERSONAL_EXAMPLES, '10B981', 'F0FDF4'),
  'Transacciones',
);

const wsInstrP = XLSX.utils.aoa_to_sheet([
  ['📋 INSTRUCCIONES — Plantilla Personal MaIA'],
  [''],
  ['1. No cambies los nombres de las columnas (fila 1).'],
  ['2. Borra las filas de ejemplo (filas 2-6) antes de pegar tus datos.'],
  ['3. Fecha: formato DD/MM/AAAA  (ej: 15/06/2025).'],
  ['4. Monto: número entero sin puntos ni $ (ej: 45000).'],
  ['5. Categoría — escribe exactamente una de:  Comida | Servicios | Transporte | Gustos'],
  ['6. Cuenta — escribe exactamente una de:  Nequi | Bancolombia'],
  ['7. Guarda como .xlsx antes de subir.'],
]);
XLSX.utils.book_append_sheet(wbPersonal, wsInstrP, 'Instrucciones');

const pathPersonal = path.join(OUT_DIR, 'plantilla-personal-maia.xlsx');
XLSX.writeFile(wbPersonal, pathPersonal, { bookType: 'xlsx', cellStyles: true });
console.log('✅  Personal:', pathPersonal);

// ─── PLANTILLA EMPRESA ────────────────────────────────────────────────────────
const EMPRESA_HEADERS = [
  'Fecha (DD/MM/AAAA)',
  'Cliente/Proveedor',
  'Nro_Factura',
  'Descripción',
  'Subtotal',
  'IVA',
  'Total',
  'Tipo (Ingreso/Egreso)',
];

const EMPRESA_EXAMPLES = [
  ['15/06/2025', 'Almacenes Éxito S.A.',  'FAC-001', 'Venta producto A',    1000000, 190000, 1190000, 'Ingreso'],
  ['16/06/2025', 'Papelería Central',     'OC-045',  'Compra suministros',   250000,  47500,  297500, 'Egreso'],
  ['17/06/2025', 'Cliente Medellín SAS',  'FAC-002', 'Servicio consultoría', 800000, 152000,  952000, 'Ingreso'],
  ['18/06/2025', 'Proveedor Bogotá Ltda', 'OC-046',  'Materia prima',        500000,  95000,  595000, 'Egreso'],
];

const wbEmpresa = XLSX.utils.book_new();
wbEmpresa.Props = { Title: 'Plantilla Empresa MaIA', Author: 'MaIA' };

XLSX.utils.book_append_sheet(
  wbEmpresa,
  buildSheet(EMPRESA_HEADERS, EMPRESA_EXAMPLES, '7C3AED', 'F5F3FF'),
  'Transacciones',
);

const wsInstrE = XLSX.utils.aoa_to_sheet([
  ['📋 INSTRUCCIONES — Plantilla Empresa MaIA'],
  [''],
  ['1. No cambies los nombres de las columnas (fila 1).'],
  ['2. Borra las filas de ejemplo (filas 2-5) antes de pegar tus datos.'],
  ['3. Fecha: formato DD/MM/AAAA  (ej: 15/06/2025).'],
  ['4. Subtotal, IVA, Total: números enteros sin puntos ni $ (ej: 1000000).'],
  ['5. Tipo — escribe exactamente:  Ingreso  o  Egreso'],
  ['6. Nro_Factura: identificador único de tu factura/OC.'],
  ['7. Guarda como .xlsx antes de subir.'],
]);
XLSX.utils.book_append_sheet(wbEmpresa, wsInstrE, 'Instrucciones');

const pathEmpresa = path.join(OUT_DIR, 'plantilla-empresa-maia.xlsx');
XLSX.writeFile(wbEmpresa, pathEmpresa, { bookType: 'xlsx', cellStyles: true });
console.log('✅  Empresa :', pathEmpresa);

console.log('\n🎉  Plantillas listas en public/templates/');
