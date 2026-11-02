/**
 * Downloadable invoice PDF.
 *
 * Every amount, name, date, tax rate, and identifier is taken from the
 * invoice record. Missing currency, tax id, IBAN, VAT, or payment terms are
 * left off the page. Nothing here substitutes EUR, a zero rate, or "Net 30".
 *
 * The embedded face is unmodified DejaVu Sans so stored letters such as č
 * are drawn as themselves. See src/assets/fonts/DejaVuSans.LICENSE.txt.
 */
import { lineAmount, roundMoney, sumMoney, taxOn } from './money';

const EXPORTABLE_STATUSES = new Set(['issued', 'sent', 'paid', 'partially_paid', 'overdue']);

export type InvoicePdfLineInput = {
  description?: string | null;
  quantity?: number | null;
  unitPrice?: number | null;
  amount?: number | null;
};

export type InvoicePdfInput = {
  status?: string | null;
  number?: string | null;
  issueDate?: string | null;
  dueDate?: string | null;
  currency?: string | null;
  sellerName?: string | null;
  sellerAddress?: string | null;
  sellerTaxId?: string | null;
  sellerIban?: string | null;
  buyerName?: string | null;
  buyerAddress?: string | null;
  buyerTaxId?: string | null;
  paymentRef?: string | null;
  notes?: string | null;
  /** Null when the invoice has no stored VAT rate. Zero is a real rate. */
  taxRate?: number | null;
  lines?: InvoicePdfLineInput[] | null;
};

export type PreparedInvoiceLine = {
  description: string;
  quantity: number | null;
  unitPrice: number | null;
  amount: number;
};

export type PreparedInvoicePdf = {
  status: string;
  number: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  sellerName: string;
  sellerAddress: string;
  sellerTaxId: string;
  sellerIban: string;
  buyerName: string;
  buyerAddress: string;
  buyerTaxId: string;
  paymentRef: string;
  notes: string;
  taxRate: number | null;
  lines: PreparedInvoiceLine[];
  subtotal: number;
  tax: number | null;
  total: number;
};

type FontInfo = {
  bytes: Uint8Array;
  unitsPerEm: number;
  bbox: [number, number, number, number];
  ascent: number;
  descent: number;
  glyphId: (codePoint: number) => number;
  advance: (glyphId: number) => number;
};

type TextRun = { text: string; x: number; y: number; size: number };
type Rule = { x1: number; y1: number; x2: number; y2: number };
type LaidPage = { texts: TextRun[]; rules: Rule[] };

const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN = 40;
const RIGHT = PAGE_W - MARGIN;

function clean(value: string | null | undefined): string {
  return (value ?? '').replace(/\r\n/g, '\n').replace(/\t/g, ' ').trim();
}

function finiteOrNull(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function prepareInvoicePdf(input: InvoicePdfInput): PreparedInvoicePdf {
  const status = clean(input.status).toLowerCase();
  if (!EXPORTABLE_STATUSES.has(status)) {
    throw new Error('Only an issued invoice can be exported as a PDF.');
  }
  const sourceLines = Array.isArray(input.lines) ? input.lines : [];
  if (sourceLines.length === 0) {
    throw new Error('Invoice has no line items.');
  }
  const lines: PreparedInvoiceLine[] = sourceLines.map((line, index) => {
    const quantity = finiteOrNull(line.quantity);
    const unitPrice = finiteOrNull(line.unitPrice);
    const storedAmount = finiteOrNull(line.amount);
    const amount = storedAmount !== null
      ? roundMoney(storedAmount)
      : quantity !== null && unitPrice !== null
        ? lineAmount(quantity, unitPrice)
        : null;
    if (amount === null) {
      throw new Error(`Invoice line ${index + 1} is missing an amount.`);
    }
    return {
      description: clean(line.description),
      quantity,
      unitPrice: unitPrice === null ? null : roundMoney(unitPrice),
      amount,
    };
  });
  const taxRate = finiteOrNull(input.taxRate);
  const subtotal = sumMoney(lines.map((line) => line.amount));
  const tax = taxRate === null ? null : taxOn(subtotal, taxRate);
  const total = tax === null ? subtotal : roundMoney(subtotal + tax);
  return {
    status,
    number: clean(input.number),
    issueDate: clean(input.issueDate),
    dueDate: clean(input.dueDate),
    currency: clean(input.currency).toUpperCase(),
    sellerName: clean(input.sellerName),
    sellerAddress: clean(input.sellerAddress),
    sellerTaxId: clean(input.sellerTaxId),
    sellerIban: clean(input.sellerIban),
    buyerName: clean(input.buyerName),
    buyerAddress: clean(input.buyerAddress),
    buyerTaxId: clean(input.buyerTaxId),
    paymentRef: clean(input.paymentRef),
    notes: clean(input.notes),
    taxRate,
    lines,
    subtotal,
    tax,
    total,
  };
}

export function formatPdfMoney(amount: number, currency: string): string {
  const text = roundMoney(amount).toFixed(2);
  return currency ? `${text} ${currency}` : text;
}

export function formatPdfQuantity(amount: number): string {
  return roundMoney(amount).toFixed(2);
}

export function invoicePdfFilename(number: string | null | undefined): string {
  const cleanName = clean(number).replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return cleanName ? `invoice-${cleanName}.pdf` : 'invoice.pdf';
}

export async function loadInvoiceFont(): Promise<Uint8Array> {
  const href = new URL('../assets/fonts/DejaVuSans.ttf', import.meta.url).href;
  const response = await fetch(href);
  if (!response.ok) throw new Error('The invoice font could not be loaded.');
  return new Uint8Array(await response.arrayBuffer());
}

function u16(view: DataView, offset: number): number {
  return view.getUint16(offset);
}
function i16(view: DataView, offset: number): number {
  return view.getInt16(offset);
}

function tagAt(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
}

function parseFont(bytes: Uint8Array): FontInfo {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const numTables = u16(view, 4);
  const tables = new Map<string, { offset: number; length: number }>();
  for (let i = 0; i < numTables; i += 1) {
    const rec = 12 + i * 16;
    tables.set(tagAt(bytes, rec), { offset: view.getUint32(rec + 8), length: view.getUint32(rec + 12) });
  }
  const head = tables.get('head');
  const cmap = tables.get('cmap');
  const hhea = tables.get('hhea');
  const hmtx = tables.get('hmtx');
  if (!head || !cmap || !hhea || !hmtx) throw new Error('Invoice font is incomplete.');

  const unitsPerEm = u16(view, head.offset + 18);
  const bbox: [number, number, number, number] = [
    i16(view, head.offset + 36),
    i16(view, head.offset + 38),
    i16(view, head.offset + 40),
    i16(view, head.offset + 42),
  ];
  const ascent = i16(view, hhea.offset + 4);
  const descent = i16(view, hhea.offset + 6);
  const numberOfHMetrics = u16(view, hhea.offset + 34);
  const glyphId = buildCmap(view, cmap.offset);

  return {
    bytes,
    unitsPerEm,
    bbox,
    ascent,
    descent,
    glyphId,
    advance(glyph) {
      const index = glyph < numberOfHMetrics ? glyph : numberOfHMetrics - 1;
      const raw = u16(view, hmtx.offset + index * 4);
      return (raw * 1000) / unitsPerEm;
    },
  };
}

function buildCmap(view: DataView, offset: number): (codePoint: number) => number {
  const subtables: number[] = [];
  const count = u16(view, offset + 2);
  for (let i = 0; i < count; i += 1) {
    const rec = offset + 4 + i * 8;
    const platform = u16(view, rec);
    const encoding = u16(view, rec + 2);
    const sub = offset + view.getUint32(rec + 4);
    if ((platform === 3 && encoding === 1) || platform === 0) subtables.push(sub);
  }
  const format4 = subtables.find((sub) => u16(view, sub) === 4);
  if (format4 === undefined) throw new Error('Invoice font has no Unicode cmap.');
  const segCount = u16(view, format4 + 6) / 2;
  const endCountAt = format4 + 14;
  const startCountAt = endCountAt + segCount * 2 + 2;
  const idDeltaAt = startCountAt + segCount * 2;
  const idRangeAt = idDeltaAt + segCount * 2;
  return (codePoint: number) => {
    if (codePoint > 0xffff) return 0;
    let lo = 0;
    let hi = segCount - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const end = u16(view, endCountAt + mid * 2);
      if (codePoint > end) lo = mid + 1;
      else if (codePoint < u16(view, startCountAt + mid * 2)) hi = mid - 1;
      else {
        const range = u16(view, idRangeAt + mid * 2);
        const delta = view.getInt16(idDeltaAt + mid * 2);
        if (range === 0) return (codePoint + delta) & 0xffff;
        const glyphPos = idRangeAt + mid * 2 + range + (codePoint - u16(view, startCountAt + mid * 2)) * 2;
        const glyph = u16(view, glyphPos);
        return glyph === 0 ? 0 : (glyph + delta) & 0xffff;
      }
    }
    return 0;
  };
}

type GlyphUse = { ch: string; width: number };

type Encoder = {
  hex: string;
  width: number;
};

function encodeText(text: string, size: number, font: FontInfo, unicode: Map<number, GlyphUse>): Encoder {
  let hex = '';
  let advances = 0;
  for (const ch of text) {
    const codePoint = ch.codePointAt(0) ?? 0;
    const glyph = font.glyphId(codePoint);
    if (!glyph) {
      throw new Error(
        `Cannot export this invoice. The PDF font has no glyph for ${ch} (U+${codePoint.toString(16).toUpperCase().padStart(4, '0')}).`,
      );
    }
    const advance = font.advance(glyph);
    const previous = unicode.get(glyph);
    if (previous && previous.ch !== ch) {
      throw new Error(`Cannot export this invoice. ${ch} and ${previous.ch} share one glyph.`);
    }
    unicode.set(glyph, { ch, width: advance });
    hex += glyph.toString(16).padStart(4, '0').toUpperCase();
    advances += advance;
  }
  return { hex, width: (advances * size) / 1000 };
}

function wrapText(text: string, size: number, maxWidth: number, font: FontInfo, unicode: Map<number, GlyphUse>): string[] {
  if (!text) return [''];
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    const words = paragraph.split(/\s+/).filter((word) => word.length > 0);
    if (words.length === 0) {
      lines.push('');
      continue;
    }
    let current = '';
    const flush = () => {
      lines.push(current);
      current = '';
    };
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (encodeText(candidate, size, font, unicode).width <= maxWidth) {
        current = candidate;
        continue;
      }
      if (current) flush();
      if (encodeText(word, size, font, unicode).width <= maxWidth) {
        current = word;
        continue;
      }
      let piece = '';
      for (const ch of word) {
        const next = piece + ch;
        if (piece && encodeText(next, size, font, unicode).width > maxWidth) {
          lines.push(piece);
          piece = ch;
        } else {
          piece = next;
        }
      }
      current = piece;
    }
    if (current) flush();
  }
  return lines.length > 0 ? lines : [''];
}

function pdfNum(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  if (!Number.isFinite(rounded) || Object.is(rounded, -0)) return '0';
  return String(rounded);
}

function layoutInvoice(doc: PreparedInvoicePdf, font: FontInfo): LaidPage[] {
  const unicode = new Map<number, GlyphUse>();
  const pages: LaidPage[] = [];
  let page: LaidPage = { texts: [], rules: [] };
  let y = PAGE_H - MARGIN;
  const openPage = () => {
    page = { texts: [], rules: [] };
    pages.push(page);
    y = PAGE_H - MARGIN;
  };
  const need = (height: number) => {
    if (y - height < MARGIN) openPage();
  };
  const draw = (text: string, x: number, size: number, at = y) => {
    if (!text) return;
    page.texts.push({ text, x, y: at, size });
  };
  openPage();

  draw('INVOICE', MARGIN, 20);
  y -= 28;
  if (doc.number) {
    need(16);
    draw(doc.number, MARGIN, 12);
    y -= 18;
  }
  const meta = [
    doc.status ? `Status: ${doc.status}` : '',
    doc.issueDate ? `Issued: ${doc.issueDate}` : '',
    doc.dueDate ? `Due: ${doc.dueDate}` : '',
    doc.currency ? `Currency: ${doc.currency}` : '',
  ].filter(Boolean);
  for (const line of meta) {
    need(14);
    draw(line, MARGIN, 10);
    y -= 14;
  }

  const partyBody = (name: string, address: string, taxId: string, iban: string) => {
    const lines: string[] = [];
    if (name) lines.push(name);
    if (address) lines.push(...address.split('\n').map((line) => line.trim()).filter(Boolean));
    if (taxId) lines.push(`Tax ID: ${taxId}`);
    if (iban) lines.push(`IBAN: ${iban}`);
    return lines;
  };
  const sellerLines = partyBody(doc.sellerName, doc.sellerAddress, doc.sellerTaxId, doc.sellerIban);
  const buyerLines = partyBody(doc.buyerName, doc.buyerAddress, doc.buyerTaxId, '');
  if (sellerLines.length > 0 || buyerLines.length > 0) {
    y -= 8;
    const colWidth = (RIGHT - MARGIN - 16) / 2;
    const size = 10;
    const sellerWrapped = sellerLines.flatMap((line) => wrapText(line, size, colWidth, font, unicode));
    const buyerWrapped = buyerLines.flatMap((line) => wrapText(line, size, colWidth, font, unicode));
    const rows = Math.max(sellerWrapped.length, buyerWrapped.length) + 1;
    need(rows * 13 + 4);
    const top = y;
    if (sellerLines.length > 0) draw('From', MARGIN, 9, top);
    if (buyerLines.length > 0) draw('Bill to', MARGIN + colWidth + 16, 9, top);
    sellerWrapped.forEach((line, index) => draw(line, MARGIN, size, top - 14 - index * 13));
    buyerWrapped.forEach((line, index) => draw(line, MARGIN + colWidth + 16, size, top - 14 - index * 13));
    y = top - 14 - (rows - 1) * 13 - 8;
  }

  const descW = 280;
  const qtyRight = MARGIN + descW + 55;
  const rateRight = qtyRight + 80;
  const amountRight = RIGHT;
  const header = (at: number) => {
    draw('Description', MARGIN, 9, at);
    const heads: Array<[string, number]> = [
      ['Qty', qtyRight],
      ['Rate', rateRight],
      ['Amount', amountRight],
    ];
    for (const [label, right] of heads) {
      const width = encodeText(label, 9, font, unicode).width;
      draw(label, right - width, 9, at);
    }
    page.rules.push({ x1: MARGIN, y1: at - 4, x2: RIGHT, y2: at - 4 });
  };
  need(22);
  header(y);
  y -= 18;

  for (const line of doc.lines) {
    const desc = wrapText(line.description, 9, descW, font, unicode);
    const rowH = Math.max(1, desc.length) * 12 + 4;
    if (y - rowH < MARGIN + 70) {
      openPage();
      header(y);
      y -= 18;
    }
    const qty = line.quantity === null ? '' : formatPdfQuantity(line.quantity);
    const rate = line.unitPrice === null ? '' : formatPdfMoney(line.unitPrice, doc.currency);
    const amount = formatPdfMoney(line.amount, doc.currency);
    const placeRight = (text: string, right: number) => {
      if (!text) return;
      draw(text, right - encodeText(text, 9, font, unicode).width, 9, y);
    };
    desc.forEach((part, index) => draw(part, MARGIN, 9, y - index * 12));
    placeRight(qty, qtyRight);
    placeRight(rate, rateRight);
    placeRight(amount, amountRight);
    y -= rowH;
  }

  y -= 8;
  const totals: Array<[string, string]> = [
    ['Subtotal', formatPdfMoney(doc.subtotal, doc.currency)],
  ];
  if (doc.taxRate !== null && doc.tax !== null) {
    totals.push([`VAT (${doc.taxRate}%)`, formatPdfMoney(doc.tax, doc.currency)]);
  }
  totals.push(['Total', formatPdfMoney(doc.total, doc.currency)]);
  need(totals.length * 16 + 8);
  page.rules.push({ x1: 340, y1: y + 8, x2: RIGHT, y2: y + 8 });
  for (const [label, value] of totals) {
    draw(label, 340, 10, y);
    draw(value, RIGHT - encodeText(value, 10, font, unicode).width, 10, y);
    y -= 16;
  }

  const footer: string[] = [];
  if (doc.paymentRef) footer.push(`Payment reference: ${doc.paymentRef}`);
  if (doc.notes) footer.push(doc.notes);
  if (footer.length > 0) {
    y -= 8;
    for (const line of footer) {
      for (const part of wrapText(line, 10, RIGHT - MARGIN, font, unicode)) {
        need(14);
        draw(part, MARGIN, 10);
        y -= 14;
      }
    }
  }
  return pages;
}

function utf16Hex(text: string): string {
  let hex = 'FEFF';
  for (const ch of text) {
    const codePoint = ch.codePointAt(0) ?? 0;
    if (codePoint > 0xffff) {
      throw new Error('Invoice text contains a character this PDF cannot store.');
    }
    hex += codePoint.toString(16).padStart(4, '0').toUpperCase();
  }
  return `<${hex}>`;
}

function toUnicodeStream(unicode: Map<number, GlyphUse>): string {
  const entries = [...unicode.entries()].sort((a, b) => a[0] - b[0]);
  let body = '%WG-INV-CMAP\n';
  body += '/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n';
  body += '/CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> def\n';
  body += '/CMapName /Adobe-Identity-UCS def\n/CMapType 2 def\n';
  body += '1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n';
  for (let i = 0; i < entries.length; i += 100) {
    const chunk = entries.slice(i, i + 100);
    body += `${chunk.length} beginbfchar\n`;
    for (const [glyph, use] of chunk) {
      const code = (use.ch.codePointAt(0) ?? 0).toString(16).padStart(4, '0').toUpperCase();
      body += `<${glyph.toString(16).padStart(4, '0').toUpperCase()}> <${code}>\n`;
    }
    body += 'endbfchar\n';
  }
  body += 'endcmap\nCMapName currentdict /CMap defineresource pop\nend\nend\n';
  return body;
}

function widthArray(unicode: Map<number, GlyphUse>): string {
  return [...unicode.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([glyph, use]) => `${glyph} [${pdfNum(use.width)}]`)
    .join(' ');
}

function pageStream(laid: LaidPage, font: FontInfo, unicode: Map<number, GlyphUse>): string {
  let body = '%WG-INV-TEXT\n0.2 0.2 0.2 RG\n0.6 w\n';
  for (const rule of laid.rules) {
    body += `${pdfNum(rule.x1)} ${pdfNum(rule.y1)} m ${pdfNum(rule.x2)} ${pdfNum(rule.y2)} l S\n`;
  }
  body += '0 0 0 rg\nBT\n';
  let size = -1;
  for (const run of laid.texts) {
    const encoded = encodeText(run.text, run.size, font, unicode);
    if (!encoded.hex) continue;
    if (run.size !== size) {
      body += `/F1 ${pdfNum(run.size)} Tf\n`;
      size = run.size;
    }
    body += `1 0 0 1 ${pdfNum(run.x)} ${pdfNum(run.y)} Tm <${encoded.hex}> Tj\n`;
  }
  body += 'ET\n';
  return body;
}

const textEncoder = new TextEncoder();

function ascii(value: string): Uint8Array {
  return textEncoder.encode(value);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function streamObject(dict: string, data: Uint8Array): Uint8Array {
  return concat([
    ascii(`<< ${dict} /Length ${data.length} >>\nstream\n`),
    data,
    ascii('\nendstream'),
  ]);
}

function serializePdf(objects: Uint8Array[], rootId: number, infoId: number | null): Uint8Array {
  const header = ascii('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n');
  const parts: Uint8Array[] = [header];
  const offsets: number[] = [0];
  let cursor = header.length;
  objects.forEach((body, index) => {
    const prefix = ascii(`${index + 1} 0 obj\n`);
    const suffix = ascii('\nendobj\n');
    offsets.push(cursor);
    cursor += prefix.length + body.length + suffix.length;
    parts.push(prefix, body, suffix);
  });
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i += 1) {
    xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  const info = infoId ? ` /Info ${infoId} 0 R` : '';
  xref += `trailer\n<< /Size ${objects.length + 1} /Root ${rootId} 0 R${info} >>\nstartxref\n${cursor}\n%%EOF\n`;
  parts.push(ascii(xref));
  return concat(parts);
}

export function buildInvoicePdf(input: InvoicePdfInput, fontBytes: Uint8Array): Uint8Array {
  const doc = prepareInvoicePdf(input);
  const font = parseFont(fontBytes);
  const laid = layoutInvoice(doc, font);
  const drawn = new Map<number, GlyphUse>();
  const n = laid.length;
  const fontFileId = 1;
  const descriptorId = 2;
  const cmapId = 3;
  const cidId = 4;
  const type0Id = 5;
  const contentId = (index: number) => 6 + index;
  const pageId = (index: number) => 6 + n + index;
  const pagesId = 6 + 2 * n;
  const catalogId = pagesId + 1;
  const infoId = doc.number ? catalogId + 1 : null;

  const contents = laid.map((page) => pageStream(page, font, drawn));
  const cmap = toUnicodeStream(drawn);
  const [xMin, yMin, xMax, yMax] = font.bbox;
  const scale = (value: number) => Math.round((value * 1000) / font.unitsPerEm);
  const objects: Uint8Array[] = [
    streamObject('', font.bytes),
    ascii(
      `<< /Type /FontDescriptor /FontName /DejaVuSans /Flags 32 /FontBBox [${scale(xMin)} ${scale(yMin)} ${scale(xMax)} ${scale(yMax)}] /ItalicAngle 0 /Ascent ${scale(font.ascent)} /Descent ${scale(font.descent)} /CapHeight ${scale(font.ascent)} /StemV 80 /FontFile2 ${fontFileId} 0 R >>`,
    ),
    streamObject('', ascii(cmap)),
    ascii(
      `<< /Type /Font /Subtype /CIDFontType2 /BaseFont /DejaVuSans /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor ${descriptorId} 0 R /CIDToGIDMap /Identity /DW 500 /W [${widthArray(drawn)}] >>`,
    ),
    ascii(
      `<< /Type /Font /Subtype /Type0 /BaseFont /DejaVuSans /Encoding /Identity-H /DescendantFonts [${cidId} 0 R] /ToUnicode ${cmapId} 0 R >>`,
    ),
  ];
  contents.forEach((content) => objects.push(streamObject('', ascii(content))));
  for (let i = 0; i < n; i += 1) {
    objects.push(ascii(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Contents ${contentId(i)} 0 R /Resources << /Font << /F1 ${type0Id} 0 R >> >> >>`,
    ));
  }
  const kids = laid.map((_, index) => `${pageId(index)} 0 R`).join(' ');
  objects.push(ascii(`<< /Type /Pages /Count ${n} /Kids [${kids}] >>`));
  objects.push(ascii(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`));
  if (infoId && doc.number) {
    objects.push(ascii(`<< /Title ${utf16Hex(doc.number)} >>`));
  }
  return serializePdf(objects, catalogId, infoId);
}

function latin1(bytes: Uint8Array): string {
  let text = '';
  for (let i = 0; i < bytes.length; i += 4096) {
    text += String.fromCharCode(...bytes.subarray(i, i + 4096));
  }
  return text;
}

function readDict(source: string, start: number): { dict: string; end: number } {
  if (source.slice(start, start + 2) !== '<<') throw new Error('PDF dictionary is missing.');
  let depth = 0;
  let i = start;
  while (i < source.length) {
    if (source[i] === '<' && source[i + 1] === '<') {
      depth += 1;
      i += 2;
      continue;
    }
    if (source[i] === '>' && source[i + 1] === '>') {
      depth -= 1;
      i += 2;
      if (depth === 0) return { dict: source.slice(start, i), end: i };
      continue;
    }
    if (source[i] === '<') {
      const close = source.indexOf('>', i + 1);
      if (close < 0) break;
      i = close + 1;
      continue;
    }
    i += 1;
  }
  throw new Error('PDF dictionary did not end.');
}

/** Pull visible text back out of a PDF this module wrote. Used by tests. */
export function extractPdfText(pdf: Uint8Array): string {
  const source = latin1(pdf);
  const marker = source.lastIndexOf('startxref');
  if (marker < 0) throw new Error('PDF xref is missing.');
  const xrefAt = Number(source.slice(marker).match(/startxref\s+(\d+)/)?.[1]);
  if (!Number.isFinite(xrefAt)) throw new Error('PDF xref offset is missing.');
  const rows = [...source.slice(xrefAt).matchAll(/^(\d{10}) \d{5} n /gm)].map((match) => Number(match[1]));
  const cmap = new Map<number, string>();
  const texts: string[] = [];
  for (const offset of rows) {
    const dictStart = source.indexOf('<<', offset);
    if (dictStart < 0 || dictStart > offset + 32) continue;
    const { dict, end } = readDict(source, dictStart);
    const length = Number(dict.match(/\/Length\s+(\d+)/)?.[1]);
    if (!Number.isFinite(length)) continue;
    const streamHeader = source.slice(end, end + 16);
    const lead = streamHeader.startsWith('\nstream\n') ? 8 : streamHeader.startsWith('stream\n') ? 7 : -1;
    if (lead < 0) continue;
    const data = source.slice(end + lead, end + lead + length);
    if (data.startsWith('%WG-INV-CMAP')) {
      for (const block of data.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
        for (const pair of block[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) {
          cmap.set(parseInt(pair[1], 16), String.fromCharCode(parseInt(pair[2], 16)));
        }
      }
    } else if (data.startsWith('%WG-INV-TEXT')) {
      for (const run of data.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)) {
        let text = '';
        for (let i = 0; i < run[1].length; i += 4) {
          text += cmap.get(parseInt(run[1].slice(i, i + 4), 16)) ?? '';
        }
        texts.push(text);
      }
    }
  }
  return texts.join('\n');
}
