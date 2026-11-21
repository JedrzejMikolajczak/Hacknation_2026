// @vitest-environment node
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import {
  buildLetter,
  fillZam,
  fillZas53,
  formatCells,
  formatDotted,
  pdfFileName,
  type AssetLoader,
} from '../generate';
import type { ApplicationPdfData } from '../types';

const load: AssetLoader = async (name) =>
  new Uint8Array(await readFile(path.resolve(__dirname, '../../../../../../public/forms', name)));

const base: ApplicationPdfData = {
  kind: 'zam',
  title: 'ZAM – wniosek o zasiłek macierzyński (Mama)',
  recipient: 'Zakład Ubezpieczeń Społecznych',
  applicant: {
    name: 'Anna Łęcka-Żółć',
    pesel: '90010112345',
    birthDate: '1990-01-01',
    bank: 'PL 12 1090 1014 0000 0712 1981 2874',
  },
  todayIso: '2026-11-21',
  sections: [{ label: 'Wnioskowany okres', value: '01.12.2026–18.05.2027' }],
  attachments: ['Skrócony odpis aktu urodzenia dziecka'],
  legalNote: 'art. 29 ustawy zasiłkowej',
  zamReason: 'birth',
  childDate: '2026-12-01',
  voluntarySickness: null,
  fullLeaveDeclaration: true,
  zamPeriods: [
    { leave: 'maternity', start: '2026-12-01', end: '2027-04-18' },
    { leave: 'parental', start: '2027-04-19', end: '2027-10-17', part: 1 },
  ],
  manualFields: [],
};

const out = process.env.PDF_OUT_DIR;

describe('formatowanie dat', () => {
  it('zamienia ISO na kropki i kratki', () => {
    expect(formatDotted('2026-03-05')).toBe('05.03.2026');
    expect(formatCells('2026-03-05')).toBe('05032026');
    expect(formatCells(null)).toBe('');
  });
  it('tworzy bezpieczną nazwę pliku', () => {
    expect(pdfFileName('ZAM – wniosek o zasiłek (Mama)')).toBe('zam-wniosek-o-zasilek-mama.pdf');
  });
});

describe('oficjalne formularze', () => {
  it('wypełnia ZAM danymi wnioskodawczyni, okresami i zaznaczeniami', async () => {
    const bytes = await fillZam(base, load);
    if (out) await writeFile(path.join(out, 'zam-filled.pdf'), bytes);
    const form = (await PDFDocument.load(bytes, { ignoreEncryption: true })).getForm();
    const text = (n: string) => form.getTextField(`topmostSubform[0].${n}`).getText();
    expect(text('Page1[0].PESEL[0]')).toBe('90010112345');
    expect(text('Page1[0].Imie[0]')).toBe('ANNA');
    expect(text('Page1[0].Nazwisko[0]')).toBe('ŁĘCKA-ŻÓŁĆ');
    expect(text('Page2[0].Numerrachunku[0]')).toBe('12109010140000071219812874');
    expect(text('Page2[0].Okres[0]')).toBe('01.12.2026 – 18.04.2027');
    expect(text('Page2[0].czesc[0]')).toBe('1');
    expect(form.getCheckBox('topmostSubform[0].Page2[0].macierzynskiego[0]').isChecked()).toBe(
      true,
    );
    expect(form.getCheckBox('topmostSubform[0].Page2[0].rodzicielskiego[0]').isChecked()).toBe(
      true,
    );
    expect(form.getCheckBox('topmostSubform[0].Page2[0].ojcowskiego[0]').isChecked()).toBe(false);
    expect(form.getCheckBox('topmostSubform[0].Page2[0].ZaznaczX1a[0]').isChecked()).toBe(true);
    expect(text('Page5[0].Data[0]')).toBe('21112026');
  });

  it('wypełnia ZAS-53', async () => {
    const bytes = await fillZas53(
      {
        ...base,
        kind: 'zas53',
        sections: [{ label: 'Wnioskowany okres', value: '01.12.2026–10.12.2026' }],
      },
      load,
    );
    if (out) await writeFile(path.join(out, 'zas53-filled.pdf'), bytes);
    const form = (await PDFDocument.load(bytes, { ignoreEncryption: true })).getForm();
    expect(form.getTextField('topmostSubform[0].Page1[0].PESEL[0]').getText()).toBe('90010112345');
    expect(form.getTextField('topmostSubform[0].Page2[0].Tekst[0]').getText()).toContain(
      '01.12.2026',
    );
  });
});

describe('pismo', () => {
  it('buduje wniosek do pracodawcy z podpisem i załącznikami', async () => {
    const bytes = await buildLetter(
      { ...base, kind: 'letter', title: 'Wniosek o udzielenie urlopu rodzicielskiego' },
      load,
    );
    if (out) await writeFile(path.join(out, 'letter.pdf'), bytes);
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(1);
    expect(pdf.getTitle()).toBe('Wniosek o udzielenie urlopu rodzicielskiego');
  });
});
