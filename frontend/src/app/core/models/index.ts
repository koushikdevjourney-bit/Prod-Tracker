/** Mongo-ready domain models. `_id` mirrors ObjectId string once Express+Mongo is wired. */

export type ActivityType = 'productive' | 'neutral' | 'unproductive' | 'sleep';

export type GoalPeriod = 'daily' | 'weekly' | 'monthly';

export type DateRangePreset =
  | 'today'
  | 'yesterday'
  | 'thisWeek'
  | 'lastWeek'
  | 'thisMonth'
  | 'lastMonth'
  | 'custom';

export interface Activity {
  _id: string;
  name: string;
  category: string;
  /** YYYY-MM-DD — calendar day this entry belongs to (start date) */
  date: string;
  /** HH:mm */
  startTime: string;
  /** HH:mm */
  endTime: string;
  /** YYYY-MM-DD when overnight / multi-day; defaults to date */
  endDate?: string;
  /** Derived — never entered manually */
  durationMinutes: number;
  type: ActivityType;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Goal {
  _id: string;
  name: string;
  /** Optional category filter for auto progress */
  category?: string;
  targetMinutes: number;
  /** Anchor date for daily goals / week/month start */
  date: string;
  period: GoalPeriod;
  createdAt: string;
  updatedAt: string;
}

export interface Habit {
  _id: string;
  name: string;
  description?: string;
  targetDaysPerWeek: number;
  /** YYYY-MM-DD completion marks */
  completedDates: string[];
  color?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryDef {
  name: string;
  defaultType: ActivityType;
  color: string;
}

export interface SleepSummary {
  date: string;
  durationMinutes: number;
  targetMinutes: number;
  deficitMinutes: number;
  weeklyAverageMinutes: number;
  activityId?: string;
}

export interface CategoryBreakdownItem {
  category: string;
  minutes: number;
  color: string;
  type: ActivityType;
}

export interface TypeBreakdown {
  productive: number;
  neutral: number;
  unproductive: number;
  sleep: number;
  untracked: number;
}

export interface OverlapPair {
  aId: string;
  bId: string;
  aName: string;
  bName: string;
}

export interface DailyStats {
  date: string;
  totalTrackedMinutes: number;
  productiveMinutes: number;
  neutralMinutes: number;
  unproductiveMinutes: number;
  sleepMinutes: number;
  untrackedMinutes: number;
  wakingMinutes: number;
  productivityPercent: number;
  categoryBreakdown: CategoryBreakdownItem[];
  typeBreakdown: TypeBreakdown;
  hasOverlaps: boolean;
  overlaps: OverlapPair[];
  activityCount: number;
}

export interface RangeStats {
  startDate: string;
  endDate: string;
  days: DailyStats[];
  totals: Omit<DailyStats, 'date' | 'categoryBreakdown' | 'overlaps' | 'hasOverlaps' | 'activityCount'> & {
    activityCount: number;
    hasOverlaps: boolean;
    avgProductivityPercent: number;
    categoryBreakdown: CategoryBreakdownItem[];
  };
}

export interface AppSettings {
  sleepTargetMinutes: number;
  displayName: string;
  theme: 'light' | 'dark' | 'system';
}

export interface DateSelection {
  preset: DateRangePreset;
  /** Primary focus date (single-day views) */
  selectedDate: string;
  rangeStart: string;
  rangeEnd: string;
}

export type ToastKind = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
  id: string;
  message: string;
  kind: ToastKind;
}

export type { AuthUser, AuthResponse, ApiErrorBody } from './auth.models';
