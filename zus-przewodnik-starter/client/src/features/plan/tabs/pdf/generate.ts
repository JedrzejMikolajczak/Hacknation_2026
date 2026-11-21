import { PDFDocument, rgb, type PDFFont, type PDFPage, type PDFTextField } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import type { ApplicationPdfData, ZamLeave, ZamPeriod } from './types';

/** Wczytuje plik z `public/forms/` – w przeglądarce przez fetch, w testach z dysku. */
export type AssetLoader = (name: string) => Promise<Uint8Array>;

export const fetchAsset: AssetLoader = async (name) => {
  const base = import.meta.env?.BASE_URL ?? '/';
  const response = await fetch(`${base}forms/${name}`);
  if (!response.ok) throw new Error(`Nie udało się wczytać pliku ${name}.`);
  return new Uint8Array(await response.arrayBuffer());
};

const digits = (value: string) => value.replace(/^\s*PL/i, '').replace(/\D/g, '');

/** `2026-03-05` → `05.03.2026` */
export function formatDotted(iso: string | null | undefined): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  return match ? `${match[3]}.${match[2]}.${match[1]}` : '';
}

/** `2026-03-05` → `05032026` (pola z kratkami dd/mm/rrrr). */
export function formatCells(iso: string | null | undefined): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  return match ? `${match[3]}${match[2]}${match[1]}` : '';
}

function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { first: parts[0] ?? '', last: '' };
  return { first: parts.slice(0, -1).join(' '), last: parts.at(-1) ?? '' };
}

async function loadFonts(doc: PDFDocument, load: AssetLoader) {
  doc.registerFontkit(fontkit);
  const [regular, bold] = await Promise.all([load('Lato-Regular.ttf'), load('Lato-Bold.ttf')]);
  return {
    regular: await doc.embedFont(regular, { subset: true }),
    bold: await doc.embedFont(bold, { subset: true }),
  };
}

/** Formularze ZUS wypełnia się WIELKIMI LITERAMI. */
const upper = (value: string) => value.toLocaleUpperCase('pl-PL');

/** Zestaw pól do wypełnienia: pełna nazwa pola w PDF → tekst; checkboxy osobno. */
interface FormFill {
  text: Record<string, string>;
  checks: string[];
}

function applyFill(doc: PDFDocument, font: PDFFont, fill: FormFill) {
  const form = doc.getForm();
  for (const [name, value] of Object.entries(fill.text)) {
    if (!value) continue;
    const field = form.getTextField(`topmostSubform[0].${name}`);
    const max = field.getMaxLength();
    field.setText(max ? value.slice(0, max) : value);
  }
  for (const name of fill.checks) form.getCheckBox(`topmostSubform[0].${name}`).check();
  // Pola wielolinijkowe: ustaw czytelny rozmiar, resztę (kratki) zostaw formularzowi.
  for (const field of form.getFields()) {
    if (field.constructor.name === 'PDFTextField') {
      const text = field as PDFTextField;
      if (text.isMultiline()) text.setFontSize(10);
    }
  }
  form.updateFieldAppearances(font);
}

function applicantFill(data: ApplicationPdfData): Record<string, string> {
  const { first, last } = splitName(data.applicant.name);
  return {
    'Page1[0].PESEL[0]': digits(data.applicant.pesel),
    'Page1[0].Dataurodzenia[0]': formatCells(data.applicant.birthDate),
    'Page1[0].Imie[0]': upper(first),
    'Page1[0].Nazwisko[0]': upper(last),
    'Page2[0].Numerrachunku[0]': digits(data.applicant.bank),
  };
}

const ZAM_LEAVE_FIELDS: Record<ZamLeave, { check: string[]; period: string; part?: string }> = {
  maternity: { check: ['Page2[0].macierzynskiego[0]'], period: 'Page2[0].Okres[0]' },
  parental: {
    check: ['Page2[0].rodzicielskiego[0]'],
    period: 'Page2[0].Okres2[0]',
    part: 'Page2[0].czesc[0]',
  },
  supplementary: { check: ['Page2[0].uzMacierzynskiego[0]'], period: 'Page2[0].Okres3[0]' },
  paternity: {
    check: ['Page2[0].ojcowskiego[0]'],
    period: 'Page2[0].Okres4[0]',
    part: 'Page2[0].Numerlokalu2[0]',
  },
};

function periodText(periods: ZamPeriod[]): string {
  return periods.map((p) => `${formatDotted(p.start)} – ${formatDotted(p.end)}`).join('; ');
}

function zamFill(data: ApplicationPdfData): FormFill {
  const text: Record<string, string> = { ...applicantFill(data) };
  const checks: string[] = [];

  const byLeave = new Map<ZamLeave, ZamPeriod[]>();
  for (const period of data.zamPeriods ?? []) {
    byLeave.set(period.leave, [...(byLeave.get(period.leave) ?? []), period]);
  }
  for (const [leave, periods] of byLeave) {
    const fields = ZAM_LEAVE_FIELDS[leave];
    checks.push(...fields.check);
    text[fields.period] = periodText(periods);
    const part = periods.length === 1 ? periods[0].part : null;
    if (fields.part && part) text[fields.part] = String(part);
  }

  // Data zakończenia zasiłku za okres macierzyński – tylko gdy jest znana.
  const maternityEnd = byLeave.get('maternity')?.at(-1)?.end;
  if (maternityEnd) text['Page2[0].Data2[0]'] = formatCells(maternityEnd);

  if (data.fullLeaveDeclaration) checks.push('Page2[0].informuje[0]');

  if (data.voluntarySickness === true) checks.push('Page2[0].TAK[0]');
  if (data.voluntarySickness === false) checks.push('Page2[0].NIE[0]');

  if (data.zamReason === 'adoption') {
    checks.push('Page2[0].ZaznaczX1b[0]');
    if (data.childDate) text['Page2[0].Data[0]'] = formatCells(data.childDate);
  } else if (data.zamReason === 'foster') {
    checks.push('Page2[0].ZaznaczX1c[0]');
    if (data.childDate) text['Page2[0].Data[0]'] = formatCells(data.childDate);
  } else if (data.zamReason === 'birth') {
    checks.push('Page2[0].ZaznaczX1a[0]');
    if (data.childDate)
      text['Page3[0].Tekst1[0]'] = `DATA URODZENIA: ${formatDotted(data.childDate)}`;
  }

  // Data oświadczenia – dzień złożenia; podpis pozostaje do własnoręcznego złożenia.
  text['Page5[0].Data[0]'] = formatCells(data.todayIso);
  return { text, checks };
}

/** Wypełnia oficjalny formularz ZAM (ZUS, wzór 2026) danymi z planu. */
export async function fillZam(
  data: ApplicationPdfData,
  load: AssetLoader = fetchAsset,
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(await load('zam.pdf'), { ignoreEncryption: true });
  const { regular } = await loadFonts(doc, load);
  applyFill(doc, regular, zamFill(data));
  return doc.save();
}

/** Wypełnia oficjalny formularz ZAS-53 (wniosek o zasiłek chorobowy). */
export async function fillZas53(
  data: ApplicationPdfData,
  load: AssetLoader = fetchAsset,
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(await load('zas53.pdf'), { ignoreEncryption: true });
  const { regular } = await loadFonts(doc, load);
  // ZAS-53: Page2[0].Data2 to data przy podpisie (Data – data ustania tytułu ubezpieczenia).
  const text: Record<string, string> = {
    ...applicantFill(data),
    'Page2[0].Data2[0]': formatCells(data.todayIso),
  };
  const period = data.sections.find((section) => /okres/i.test(section.label));
  if (period) text['Page2[0].Tekst[0]'] = period.value;
  applyFill(doc, regular, { text, checks: [] });
  return doc.save();
}

// ───────────────────────── Pismo (pracodawca / USC) ─────────────────────────

const PAGE = { width: 595.28, height: 841.89, margin: 56 };

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
      } else {
        if (line) lines.push(line);
        line = word;
      }
    }
    lines.push(line);
  }
  return lines;
}

class Writer {
  page: PDFPage;
  y: number;
  constructor(
    private doc: PDFDocument,
    private regular: PDFFont,
    private bold: PDFFont,
  ) {
    this.page = doc.addPage([PAGE.width, PAGE.height]);
    this.y = PAGE.height - PAGE.margin;
  }
  private ensure(height: number) {
    if (this.y - height >= PAGE.margin) return;
    this.page = this.doc.addPage([PAGE.width, PAGE.height]);
    this.y = PAGE.height - PAGE.margin;
  }
  gap(height: number) {
    this.y -= height;
  }
  text(
    value: string,
    opts: {
      size?: number;
      bold?: boolean;
      align?: 'left' | 'right' | 'center';
      x?: number;
      width?: number;
    } = {},
  ) {
    const size = opts.size ?? 11;
    const font = opts.bold ? this.bold : this.regular;
    const x0 = opts.x ?? PAGE.margin;
    const width = opts.width ?? PAGE.width - PAGE.margin - x0;
    for (const line of wrap(value, font, size, width)) {
      this.ensure(size * 1.45);
      const lineWidth = font.widthOfTextAtSize(line, size);
      const x =
        opts.align === 'right'
          ? x0 + width - lineWidth
          : opts.align === 'center'
            ? x0 + (width - lineWidth) / 2
            : x0;
      this.page.drawText(line, { x, y: this.y - size, size, font, color: rgb(0.08, 0.08, 0.08) });
      this.y -= size * 1.45;
    }
  }
  rule() {
    this.ensure(8);
    this.page.drawLine({
      start: { x: PAGE.margin, y: this.y },
      end: { x: PAGE.width - PAGE.margin, y: this.y },
      thickness: 0.6,
      color: rgb(0.6, 0.6, 0.6),
    });
    this.y -= 8;
  }
  signature(label: string) {
    this.ensure(70);
    this.gap(40);
    const width = 190;
    const x = PAGE.width - PAGE.margin - width;
    this.page.drawLine({
      start: { x, y: this.y },
      end: { x: x + width, y: this.y },
      thickness: 0.6,
      color: rgb(0.2, 0.2, 0.2),
    });
    this.y -= 4;
    this.text(label, { size: 9, align: 'center', x, width });
  }
}

/** Pismo urzędowe: nagłówek (dane wnioskodawcy, data), adresat, tytuł, treść, załączniki, podpis. */
export async function buildLetter(
  data: ApplicationPdfData,
  load: AssetLoader = fetchAsset,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const { regular, bold } = await loadFonts(doc, load);
  doc.setTitle(data.title);
  doc.setLanguage('pl-PL');
  const w = new Writer(doc, regular, bold);

  // Lewy górny róg: dane wnioskodawcy; prawy: miejscowość i data.
  const applicantLines = [
    data.applicant.name,
    data.applicant.pesel ? `PESEL: ${digits(data.applicant.pesel)}` : '',
    '…………………………………………  (adres do korespondencji)',
  ].filter(Boolean);
  w.text(`…………………………, ${formatDotted(data.todayIso)}`, { align: 'right', size: 10 });
  w.gap(2);
  for (const line of applicantLines) w.text(line, { size: 10 });
  w.gap(18);

  w.text('Adresat:', { size: 9 });
  w.text(data.recipient, { bold: true, size: 11, width: 260 });
  w.gap(24);

  w.text(data.title, { bold: true, size: 15, align: 'center' });
  w.gap(10);

  w.text(
    'Zwracam się z wnioskiem o rozpatrzenie sprawy zgodnie z poniższymi danymi. Oświadczam, że podane informacje są zgodne z prawdą.',
    { size: 11 },
  );
  w.gap(8);

  for (const section of data.sections) {
    w.text(section.label, { size: 9, bold: true });
    w.text(section.value.trim() || '…………………………………', { size: 11 });
    w.gap(4);
  }

  if (data.attachments.length) {
    w.gap(6);
    w.text('Załączniki:', { bold: true });
    data.attachments.forEach((attachment, index) =>
      w.text(`${index + 1}. ${attachment}`, { size: 10 }),
    );
  }

  w.gap(6);
  if (data.legalNote) {
    w.rule();
    w.text(`Podstawa prawna: ${data.legalNote}`, { size: 9 });
  }
  w.signature('(czytelny podpis wnioskodawcy)');
  return doc.save();
}

/** Nazwa pliku do pobrania, np. `wniosek-zam-mama.pdf`. */
export function pdfFileName(title: string): string {
  const slug = title
    .toLocaleLowerCase('pl-PL')
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${slug || 'wniosek'}.pdf`;
}

export async function generateApplicationPdf(
  data: ApplicationPdfData,
  load: AssetLoader = fetchAsset,
): Promise<Uint8Array> {
  if (data.kind === 'zam') return fillZam(data, load);
  if (data.kind === 'zas53') return fillZas53(data, load);
  return buildLetter(data, load);
}

export function downloadPdf(bytes: Uint8Array, fileName: string) {
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
