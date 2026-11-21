import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import type { MockProfileSummary, ZusData } from '@shared/types';
import annaUop from '../../../data/profiles/anna-uop.json';
import katarzynaJdgDlug from '../../../data/profiles/katarzyna-jdg-dlug.json';
import magdalenaJdgCzysto from '../../../data/profiles/magdalena-jdg-czysto.json';
import mariaZlecenie from '../../../data/profiles/maria-zlecenie.json';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const isoMonth = z.string().regex(/^\d{4}-\d{2}$/);
const insuranceTitle = z.enum(['employment', 'mandateContract', 'selfEmployed', 'none']);
const sicknessInsurance = z.enum(['mandatory', 'voluntary', 'none']);

const parentDataSchema = z.object({
  role: z.enum(['mother', 'father']),
  insuranceTitle,
  sicknessInsurance,
  insuredSince: isoDate.nullable(),
  insuranceEndDate: isoDate.nullable(),
  benefitBase: z.number().nonnegative().nullable(),
  employerInsuredCount: z.number().int().positive().nullable(),
  age: z.number().int().min(15).max(100).nullable(),
  contributionDebt: z.number().nonnegative().nullable(),
  wantsLeave: z.boolean(),
  secondaryInsuranceTitle: insuranceTitle.nullable().optional(),
  secondarySicknessInsurance: sicknessInsurance.nullable().optional(),
});

const payComponentSchema = z.object({
  kind: z.enum(['monthly', 'monthlyNonSupplemented', 'quarterly', 'annual', 'excluded']),
  amount: z.number().nonnegative(),
});

const monthlyIncomeSchema = z.object({
  month: isoMonth,
  grossAmount: z.number().nonnegative(),
  workedDays: z.number().int().nonnegative().nullable(),
  requiredWorkingDays: z.number().int().nonnegative().nullable(),
  components: z.array(payComponentSchema).optional(),
});

const sickLeaveCertificateSchema = z.object({
  id: z.string().min(1),
  startDate: isoDate,
  endDate: isoDate,
  pregnancyCode: z.boolean(),
});

const mockProfileRecordSchema = z.object({
  label: z.string().min(1),
  profile: z.object({
    profileId: z.string().min(1),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    mother: parentDataSchema,
  }),
  incomes: z.array(monthlyIncomeSchema),
  sickLeaveCertificates: z.array(sickLeaveCertificateSchema),
  contributionDebt: z.number().nonnegative(),
});

export interface MockProfileRecord extends ZusData {
  label: string;
}

export class ProfileNotFoundError extends Error {
  readonly profileId: string;

  constructor(profileId: string) {
    super(`Nie znaleziono profilu demonstracyjnego: ${profileId}`);
    this.name = 'ProfileNotFoundError';
    this.profileId = profileId;
  }
}

const DEFAULT_RAW_PROFILES: unknown[] = [
  annaUop,
  katarzynaJdgDlug,
  magdalenaJdgCzysto,
  mariaZlecenie,
];

function parseRecords(rawRecords: unknown[]): MockProfileRecord[] {
  return rawRecords.map((item) => mockProfileRecordSchema.parse(item));
}

export class ProfileStore {
  private readonly records: Map<string, MockProfileRecord>;

  constructor(records?: MockProfileRecord[]) {
    const parsed = records ?? parseRecords(DEFAULT_RAW_PROFILES);
    this.records = new Map(parsed.map((record) => [record.profile.profileId, record]));
  }

  static fromDirectory(dirPath: string): ProfileStore {
    const files = readdirSync(dirPath)
      .filter((name) => name.endsWith('.json'))
      .sort((a, b) => a.localeCompare(b));
    const raw = files.map((file) => JSON.parse(readFileSync(join(dirPath, file), 'utf8')) as unknown);
    return new ProfileStore(parseRecords(raw));
  }

  listSummaries(): MockProfileSummary[] {
    return Array.from(this.records.values()).map(({ profile, label }) => ({
      profileId: profile.profileId,
      label,
    }));
  }

  getById(profileId: string): MockProfileRecord {
    const found = this.records.get(profileId);
    if (!found) {
      throw new ProfileNotFoundError(profileId);
    }
    return structuredClone(found);
  }
}

export const defaultProfileStore = new ProfileStore();
