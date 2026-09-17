export type GritResult = 'none' | 'gold' | 'silver' | 'retry';
export type GritTarget = 'gold' | 'silver';

export interface GritBand {
  band: string;
  miles: number;
}

export interface GritSubjectDef {
  subject: string;
  format: string;
  minutes: number;
  gold: GritBand;
  silver: GritBand;
  retry: GritBand;
}

export interface GritLevelDef {
  level: number;
  subjects: GritSubjectDef[];
}

export interface GritProgress {
  id: string;
  level: number;
  subject: string;
  result: GritResult;
  target: GritTarget;
  inClimb: boolean;
  position: number;
}

export const GRIT_RESULT_LABEL: Record<GritResult, string> = {
  none: 'Not attempted',
  gold: 'Gold',
  silver: 'Silver',
  retry: 'Try again',
};

const retry = (band: string): GritBand => ({ band, miles: 5 });

export const GRIT_LEVELS: GritLevelDef[] = [
  {
    level: 1,
    subjects: [
      {
        subject: 'Applied Gen AI Development',
        format: 'MCQs',
        minutes: 30,
        gold: { band: '90% – 100%', miles: 20 },
        silver: { band: '80% – 89.99%', miles: 18 },
        retry: retry('0% – 79.99%'),
      },
      {
        subject: 'CS Fundamentals',
        format: 'MCQs',
        minutes: 40,
        gold: { band: '90% – 100%', miles: 10 },
        silver: { band: '85% – 89.99%', miles: 9 },
        retry: retry('0% – 84.99%'),
      },
      {
        subject: 'Computational Thinking',
        format: 'Coding',
        minutes: 90,
        gold: { band: '100%', miles: 20 },
        silver: { band: '83.33% – 99.99%', miles: 18 },
        retry: retry('0% – 83.32%'),
      },
      {
        subject: 'Critical Thinking & Communication',
        format: 'MCQs',
        minutes: 40,
        gold: { band: '95% – 100%', miles: 10 },
        silver: { band: '75% – 94.99%', miles: 9 },
        retry: retry('0% – 74.99%'),
      },
      {
        subject: 'DS & ML',
        format: 'MCQs + Coding',
        minutes: 90,
        gold: { band: '90% – 100%', miles: 20 },
        silver: { band: '85% – 89.99%', miles: 18 },
        retry: retry('0% – 84.99%'),
      },
      {
        subject: 'Physical AI',
        format: 'MCQs + Coding',
        minutes: 90,
        gold: { band: '85% – 100%', miles: 20 },
        silver: { band: '70% – 84.99%', miles: 18 },
        retry: retry('0% – 69.99%'),
      },
      {
        subject: 'Quantitative Reasoning',
        format: 'MCQs',
        minutes: 30,
        gold: { band: '90% – 100%', miles: 10 },
        silver: { band: '75% – 89.99%', miles: 9 },
        retry: retry('0% – 74.99%'),
      },
      {
        subject: 'SQL',
        format: 'MCQs + Coding',
        minutes: 90,
        gold: { band: '90% – 100%', miles: 10 },
        silver: { band: '85% – 89.99%', miles: 9 },
        retry: retry('0% – 84.99%'),
      },
      {
        subject: 'Server-Side Engineering',
        format: 'MCQs + Coding',
        minutes: 90,
        gold: { band: '95% – 100%', miles: 10 },
        silver: { band: '90% – 94.99%', miles: 9 },
        retry: retry('0% – 89.99%'),
      },
      {
        subject: 'UI Engineering',
        format: 'MCQs + Coding',
        minutes: 90,
        gold: { band: '85% – 100%', miles: 10 },
        silver: { band: '70% – 84.99%', miles: 9 },
        retry: retry('0% – 69.99%'),
      },
    ],
  },
  {
    level: 2,
    subjects: [
      {
        subject: 'Applied Gen AI Development',
        format: 'MCQs',
        minutes: 30,
        gold: { band: '90% – 100%', miles: 80 },
        silver: { band: '80% – 89.99%', miles: 72 },
        retry: retry('0% – 79.99%'),
      },
      {
        subject: 'CS Fundamentals',
        format: 'MCQs',
        minutes: 80,
        gold: { band: '90% – 100%', miles: 40 },
        silver: { band: '85% – 89.99%', miles: 36 },
        retry: retry('0% – 84.99%'),
      },
      {
        subject: 'Computational Thinking',
        format: 'Coding',
        minutes: 90,
        gold: { band: '100%', miles: 80 },
        silver: { band: '75% – 99.99%', miles: 72 },
        retry: retry('0% – 74.99%'),
      },
      {
        subject: 'Critical Thinking & Communication',
        format: 'MCQs',
        minutes: 30,
        gold: { band: '90% – 100%', miles: 20 },
        silver: { band: '80% – 89.99%', miles: 18 },
        retry: retry('0% – 79.99%'),
      },
      {
        subject: 'Quantitative Reasoning',
        format: 'MCQs',
        minutes: 40,
        gold: { band: '95% – 100%', miles: 40 },
        silver: { band: '80% – 94.99%', miles: 36 },
        retry: retry('0% – 79.99%'),
      },
      {
        subject: 'UI Engineering',
        format: 'MCQs + IDE Coding',
        minutes: 90,
        gold: { band: '90% – 100%', miles: 40 },
        silver: { band: '80% – 89.99%', miles: 36 },
        retry: retry('0% – 79.99%'),
      },
    ],
  },
];

export const GRIT_MAX_MILES = GRIT_LEVELS.reduce(
  (sum, level) => sum + level.subjects.reduce((s, sub) => s + sub.gold.miles, 0),
  0,
);

export const GRIT_SUBJECT_COUNT = GRIT_LEVELS.reduce((sum, level) => sum + level.subjects.length, 0);

export function gritKey(level: number, subject: string): string {
  return `${level}::${subject}`;
}

export function milesForResult(def: GritSubjectDef, result: GritResult): number {
  if (result === 'gold') return def.gold.miles;
  if (result === 'silver') return def.silver.miles;
  if (result === 'retry') return def.retry.miles;
  return 0;
}

export function findGritSubject(level: number, subject: string): GritSubjectDef | undefined {
  return GRIT_LEVELS.find((l) => l.level === level)?.subjects.find((s) => s.subject === subject);
}
