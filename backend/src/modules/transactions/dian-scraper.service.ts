import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { load, type CheerioAPI } from 'cheerio';

export interface DianInvoiceData {
  emisor:    string | null;
  nit:       string | null;
  fecha:     string | null;
  total:     number | null;
  subtotal:  number | null;
  iva:       number | null;
  cufe:      string | null;
  categoria: string;
  rawUrl:    string;
}

// ─── Reglas de auto-clasificación ────────────────────────────────────────────
const KEYWORD_RULES: { keywords: string[]; category: string }[] = [
  {
    keywords: ['exito', 'éxito', 'd1', 'olimpica', 'olímpica', 'jumbo', 'carulla', 'ara',
               'metro', 'surtimax', 'supertienda', 'supermercado', 'bodega', 'alkosto',
               'makro', 'fruver', 'mercado', 'lacteos', 'listo'],
    category: 'Alimentación',
  },
  {
    keywords: ['biomax', 'primax', 'terpel', 'texaco', 'bp', 'gasolina', 'combustible',
               'estacion de servicio', 'peaje', 'transmilenio', 'sitp', 'uber', 'cabify',
               'indriver', 'bus', 'taxi'],
    category: 'Transporte',
  },
  {
    keywords: ['farmacia', 'drogas', 'drogueria', 'droguería', 'colsubsidio', 'cafam',
               'salud', 'clinica', 'clínica', 'hospital', 'medico', 'médico', 'laboratorio',
               'optica', 'óptica', 'veterinaria'],
    category: 'Salud',
  },
  {
    keywords: ['netflix', 'spotify', 'amazon', 'disney', 'hbo', 'apple', 'google',
               'youtube', 'internet', 'claro', 'movistar', 'tigo', 'wom', 'etb', 'une',
               'telefonica', 'telefonía', 'celular', 'plan movil'],
    category: 'Servicios',
  },
  {
    keywords: ['restaurante', 'panaderia', 'panadería', 'pizzeria', 'pizzería', 'burger',
               'mcdonald', 'subway', 'dominos', 'pizza', 'sushi', 'cafe', 'cafetería',
               'cafeteria', 'lunch', 'asadero', 'frisby', 'kokoriko', 'crepes'],
    category: 'Restaurantes',
  },
  {
    keywords: ['falabella', 'zara', 'h&m', 'adidas', 'nike', 'ropa', 'calzado',
               'zapatos', 'jeans', 'moda', 'boutique', 'almacen', 'almacén', 'priceshoes',
               'bata', 'arturo calle'],
    category: 'Ropa y Moda',
  },
  {
    keywords: ['cine', 'cinepolis', 'cinemark', 'royal', 'teatro', 'entretenimiento',
               'juegos', 'gym', 'gimnasio', 'deporte', 'parque', 'planeta'],
    category: 'Entretenimiento',
  },
  {
    keywords: ['universidad', 'colegio', 'escuela', 'instituto', 'educacion', 'educación',
               'curso', 'libro', 'libreria', 'librería', 'papeleria', 'papelería'],
    category: 'Educación',
  },
  {
    keywords: ['hotel', 'hostal', 'airbnb', 'motel', 'alojamiento', 'vuelo', 'aerolinea',
               'aerolínea', 'latam', 'avianca', 'viva', 'wingo'],
    category: 'Viajes',
  },
];

// ─── Labels que busca en el HTML de la DIAN ──────────────────────────────────
const FIELD_LABELS = {
  emisor:   ['Razón Social', 'Razon Social', 'Nombre del Emisor', 'Emisor', 'Proveedor Tecnológico'],
  nit:      ['NIT', 'Nit', 'NIT Emisor', 'Identificación del Emisor', 'No. Identificación'],
  fecha:    ['Fecha', 'Fecha de Emisión', 'Fecha Emisión', 'Fecha y Hora', 'Fecha Validación'],
  total:    ['Total', 'Valor Total', 'Grand Total', 'Total Factura', 'Valor a Pagar', 'Total a Pagar'],
  subtotal: ['Subtotal', 'Base Gravable', 'Sub Total', 'Valor Bruto'],
  iva:      ['IVA', 'Impuesto', 'Valor IVA', 'Total Impuestos', 'Total IVA', 'Impuesto a las Ventas'],
};

@Injectable()
export class DianScraperService {
  private readonly logger = new Logger(DianScraperService.name);

  async scrape(url: string): Promise<DianInvoiceData> {
    this.logger.log(`[DIAN] Iniciando scraping → ${url}`);

    const html = await this.fetchHtml(url);
    const $    = load(html);

    const emisor   = this.findField($, FIELD_LABELS.emisor);
    const nit      = this.findField($, FIELD_LABELS.nit);
    const fecha    = this.findField($, FIELD_LABELS.fecha);
    const total    = this.toCurrency(this.findField($, FIELD_LABELS.total));
    const subtotal = this.toCurrency(this.findField($, FIELD_LABELS.subtotal));
    const iva      = this.toCurrency(this.findField($, FIELD_LABELS.iva));

    // CUFE desde query param o desde el HTML
    let cufe: string | null = null;
    try {
      cufe = new URL(url).searchParams.get('documentkey')
          ?? new URL(url).searchParams.get('cufe')
          ?? this.findField($, ['CUFE', 'Código Único de Factura Electrónica']);
    } catch { cufe = null; }

    const categoria = this.classify(emisor ?? '');

    this.logger.log(`[DIAN] OK → emisor=${emisor} total=${total} cat=${categoria}`);

    return { emisor, nit, fecha, total, subtotal, iva, cufe, categoria, rawUrl: url };
  }

  // ── Petición HTTP con User-Agent y timeout ────────────────────────────────

  private async fetchHtml(url: string): Promise<string> {
    try {
      const { data } = await axios.get<string>(url, {
        timeout: 15_000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept':     'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'es-CO,es;q=0.9,en;q=0.8',
        },
        maxRedirects: 5,
      });
      return data;
    } catch (err) {
      const msg = (err as Error).message;
      this.logger.error(`[DIAN] HTTP error: ${msg}`);
      throw new Error(`No se pudo conectar al portal DIAN: ${msg}`);
    }
  }

  // ── Extracción de campo por múltiples estrategias ─────────────────────────

  private findField($: CheerioAPI, labels: string[]): string | null {
    // Estrategia 1: buscar en th → td de la misma fila
    for (const label of labels) {
      const header = $('th, td, dt, label, b, strong').filter((_, el) =>
        $(el).text().trim().toLowerCase() === label.toLowerCase(),
      ).first();

      if (header.length) {
        // th → siguiente td en la misma fila
        const rowTd = header.closest('tr').find('td').last();
        const v1 = rowTd.text().trim();
        if (v1 && v1.toLowerCase() !== label.toLowerCase()) return v1;

        // dt → siguiente dd (definition list)
        const dd = header.next('dd');
        const v2 = dd.text().trim();
        if (v2) return v2;
      }
    }

    // Estrategia 2: búsqueda parcial (el label puede tener texto adicional)
    for (const label of labels) {
      const header = $('th, td, dt, label, b, strong').filter((_, el) =>
        $(el).text().trim().toLowerCase().includes(label.toLowerCase()),
      ).first();

      if (header.length) {
        const rowTd = header.closest('tr').find('td').last();
        const v = rowTd.text().trim();
        if (v && !labels.some(l => v.toLowerCase().includes(l.toLowerCase()))) return v;
      }
    }

    // Estrategia 3: regex sobre el texto completo del HTML
    const fullText = $('body').text();
    for (const label of labels) {
      const re = new RegExp(`${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[:\\s]+([^\\n\\r]{2,80})`, 'i');
      const m  = fullText.match(re);
      if (m?.[1]) return m[1].trim();
    }

    return null;
  }

  // ── Parseo de moneda colombiana ───────────────────────────────────────────

  private toCurrency(raw: string | null): number | null {
    if (!raw) return null;
    const cleaned = raw.replace(/[^0-9.,]/g, '');
    if (!cleaned) return null;

    // Formato colombiano 1.234.567,89 → punto miles, coma decimal
    if (cleaned.includes(',') && cleaned.includes('.')) {
      return cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')
        ? parseFloat(cleaned.replace(/\./g, '').replace(',', '.'))
        : parseFloat(cleaned.replace(/,/g, ''));
    }
    if (cleaned.includes(',')) return parseFloat(cleaned.replace(',', '.'));
    return parseFloat(cleaned) || null;
  }

  // ── Auto-clasificación por palabras clave ─────────────────────────────────

  private classify(emisor: string): string {
    const lower = emisor.toLowerCase();
    for (const { keywords, category } of KEYWORD_RULES) {
      if (keywords.some(kw => lower.includes(kw))) return category;
    }
    return 'Gastos Generales';
  }
}
