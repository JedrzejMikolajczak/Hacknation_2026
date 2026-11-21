import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import type { MockProfileSummary, UserProfile, ZusData } from '@shared/types';
import anna from '../../../data/profiles/anna.json';
import annaUop from '../../../data/profiles/anna-uop.json';
import jan from '../../../data/profiles/jan.json';
import katarzynaJdgDlug from '../../../data/profiles/katarzyna-jdg-dlug.json';
import magdalenaJdgCzysto from '../../../data/profiles/magdalena-jdg-czysto.json';
import mariaZlecenie from '../../../data/profiles/maria-zlecenie.json';
import { UnknownProfileError } from './AuthProvider';

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

const fullProfileRecordSchema = z.object({
  label: z.string().min(1),
  profile: z.object({
    profileId: z.string().min(1),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    pesel: z.string().regex(/^\d{11}$/),
    birthDate: isoDate,
    mother: parentDataSchema,
  }),
  incomes: z.array(monthlyIncomeSchema),
  sickLeaveCertificates: z.array(sickLeaveCertificateSchema),
  contributionDebt: z.number().nonnegative(),
});

const identityOnlyRecordSchema = z.object({
  profileId: z.string().min(1),
  label: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  pesel: z.string().regex(/^\d{11}$/),
  birthDate: isoDate,
});

const emptyInsurance: UserProfile['mother'] = {
  role: 'mother',
  insuranceTitle: 'none',
  sicknessInsurance: 'none',
  insuredSince: null,
  insuranceEndDate: null,
  benefitBase: null,
  employerInsuredCount: null,
  age: null,
  contributionDebt: null,
  wantsLeave: false,
};

export interface MockProfileRecord extends ZusData {
  label: string;
}

export class ProfileNotFoundError extends UnknownProfileError {
  readonly profileId: string;

  constructor(profileId: string) {
    super(`Nie znaleziono profilu demonstracyjnego: ${profileId}`);
    this.name = 'ProfileNotFoundError';
    this.profileId = profileId;
  }
}

const DEFAULT_RAW_PROFILES: unknown[] = [
  anna,
  jan,
  annaUop,
  katarzynaJdgDlug,
  magdalenaJdgCzysto,
  mariaZlecenie,
];

function parseOneRecord(item: unknown): MockProfileRecord {
  const full = fullProfileRecordSchema.safeParse(item);
  if (full.success) return full.data;
  const identity = identityOnlyRecordSchema.parse(item);
  return {
    label: identity.label,
    profile: {
      profileId: identity.profileId,
      firstName: identity.firstName,
      lastName: identity.lastName,
      pesel: identity.pesel,
      birthDate: identity.birthDate,
      mother: { ...emptyInsurance },
    },
    incomes: [],
    sickLeaveCertificates: [],
    contributionDebt: 0,
  };
}

function parseRecords(rawRecords: unknown[]): MockProfileRecord[] {
  return rawRecords.map(parseOneRecord);
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
