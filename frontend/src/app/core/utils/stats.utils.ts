import {
  Activity,
  ActivityType,
  CategoryBreakdownItem,
  DailyStats,
  Goal,
  OverlapPair,
  RangeStats,
  TypeBreakdown,
} from '../models';
import { CATEGORIES, MINUTES_PER_DAY } from '../constants/categories';

/** Parse HH:mm → minutes from midnight */
export function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(':').map((v) => Number(v));
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

export function minutesToTime(total: number): string {
  const clamped = ((total % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function formatDuration(minutes: number): string {
  const abs = Math.abs(Math.round(minutes));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return '0%';
  return `${Math.round(value)}%`;
}

export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(dateKey: string, days: number): string {
  const d = parseDateKey(dateKey);
  d.setDate(d.getDate() + days);
  return toDateKey(d);
}

export function daysBetween(startKey: string, endKey: string): number {
  const a = parseDateKey(startKey).getTime();
  const b = parseDateKey(endKey).getTime();
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}

export function todayKey(): string {
  return toDateKey(new Date());
}

export function startOfWeek(dateKey: string): string {
  const d = parseDateKey(dateKey);
  const day = d.getDay(); // 0 Sun
  const diff = day === 0 ? -6 : 1 - day; // Monday start
  d.setDate(d.getDate() + diff);
  return toDateKey(d);
}

export function endOfWeek(dateKey: string): string {
  return addDays(startOfWeek(dateKey), 6);
}

export function startOfMonth(dateKey: string): string {
  const d = parseDateKey(dateKey);
  d.setDate(1);
  return toDateKey(d);
}

export function endOfMonth(dateKey: string): string {
  const d = parseDateKey(dateKey);
  d.setMonth(d.getMonth() + 1, 0);
  return toDateKey(d);
}

export function eachDateInRange(start: string, end: string): string[] {
  const out: string[] = [];
  let cur = start;
  while (cur <= end) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

/**
 * Duration in minutes. Supports overnight (end <= start → +24h)
 * or explicit endDate spanning multiple days.
 */
export function calculateDuration(
  startTime: string,
  endTime: string,
  startDate?: string,
  endDate?: string,
): number {
  const start = parseTimeToMinutes(startTime);
  let end = parseTimeToMinutes(endTime);

  if (startDate && endDate && endDate !== startDate) {
    end += daysBetween(startDate, endDate) * MINUTES_PER_DAY;
  } else if (end <= start) {
    end += MINUTES_PER_DAY;
  }

  return Math.max(0, end - start);
}

export function calculateSleepDuration(
  startTime: string,
  endTime: string,
  startDate?: string,
  endDate?: string,
): number {
  return calculateDuration(startTime, endTime, startDate, endDate);
}

interface AbsoluteInterval {
  id: string;
  name: string;
  type: ActivityType;
  category: string;
  startAbs: number;
  endAbs: number;
}

/** Absolute minutes from epoch-ish day 0 of startDate for overlap math within a day window */
function toAbsoluteInterval(activity: Activity, dayKey: string): AbsoluteInterval | null {
  const startDate = activity.date;
  const endDate = activity.endDate ?? (
    parseTimeToMinutes(activity.endTime) <= parseTimeToMinutes(activity.startTime)
      ? addDays(activity.date, 1)
      : activity.date
  );

  const startAbs =
    daysBetween(dayKey, startDate) * MINUTES_PER_DAY + parseTimeToMinutes(activity.startTime);
  let endAbs =
    daysBetween(dayKey, endDate) * MINUTES_PER_DAY + parseTimeToMinutes(activity.endTime);

  if (endAbs <= startAbs) {
    endAbs += MINUTES_PER_DAY;
  }

  // Clip to [0, 1440) relative to dayKey — portions of this calendar day
  const dayStart = 0;
  const dayEnd = MINUTES_PER_DAY;
  const clippedStart = Math.max(startAbs, dayStart);
  const clippedEnd = Math.min(endAbs, dayEnd);

  if (clippedEnd <= clippedStart) {
    // Activity belongs to this date field but overnight may land next day —
    // still count full duration on activity.date for simpler day attribution
    if (activity.date === dayKey) {
      return {
        id: activity._id,
        name: activity.name,
        type: activity.type,
        category: activity.category,
        startAbs: parseTimeToMinutes(activity.startTime),
        endAbs: parseTimeToMinutes(activity.startTime) + activity.durationMinutes,
      };
    }
    return null;
  }

  return {
    id: activity._id,
    name: activity.name,
    type: activity.type,
    category: activity.category,
    startAbs: clippedStart,
    endAbs: clippedEnd,
  };
}

export function detectOverlappingActivities(activities: Activity[], dayKey?: string): OverlapPair[] {
  const day = dayKey ?? (activities[0]?.date ?? todayKey());
  const intervals = activities
    .filter((a) => a.date === day || a.endDate === day || overlapsDay(a, day))
    .map((a) => toAbsoluteInterval(a, day))
    .filter((x): x is AbsoluteInterval => !!x)
    .sort((a, b) => a.startAbs - b.startAbs);

  const pairs: OverlapPair[] = [];
  for (let i = 0; i < intervals.length; i++) {
    for (let j = i + 1; j < intervals.length; j++) {
      const a = intervals[i];
      const b = intervals[j];
      if (b.startAbs >= a.endAbs) break;
      if (a.startAbs < b.endAbs && b.startAbs < a.endAbs) {
        pairs.push({ aId: a.id, bId: b.id, aName: a.name, bName: b.name });
      }
    }
  }
  return pairs;
}

function overlapsDay(a: Activity, day: string): boolean {
  const endDate =
    a.endDate ??
    (parseTimeToMinutes(a.endTime) <= parseTimeToMinutes(a.startTime) ? addDays(a.date, 1) : a.date);
  return a.date <= day && endDate >= day;
}

const TYPE_PRIORITY: Record<ActivityType, number> = {
  productive: 4,
  sleep: 3,
  neutral: 2,
  unproductive: 1,
};

/**
 * Merge overlapping intervals so each minute counts once (highest type priority wins).
 * Prevents silent double-counting in totals / productivity.
 */
function mergeByPriority(intervals: AbsoluteInterval[]): {
  productive: number;
  neutral: number;
  unproductive: number;
  sleep: number;
  tracked: number;
} {
  const events: { t: number; delta: number; type: ActivityType; id: string }[] = [];
  for (const iv of intervals) {
    events.push({ t: iv.startAbs, delta: 1, type: iv.type, id: iv.id });
    events.push({ t: iv.endAbs, delta: -1, type: iv.type, id: iv.id });
  }
  events.sort((a, b) => a.t - b.t || a.delta - b.delta);

  const active = new Map<string, ActivityType>();
  let prev = 0;
  let productive = 0;
  let neutral = 0;
  let unproductive = 0;
  let sleep = 0;
  let tracked = 0;

  const winner = (): ActivityType | null => {
    let best: ActivityType | null = null;
    let bestP = -1;
    for (const t of active.values()) {
      if (TYPE_PRIORITY[t] > bestP) {
        bestP = TYPE_PRIORITY[t];
        best = t;
      }
    }
    return best;
  };

  for (const ev of events) {
    const w = winner();
    const span = ev.t - prev;
    if (span > 0 && w) {
      tracked += span;
      if (w === 'productive') productive += span;
      else if (w === 'neutral') neutral += span;
      else if (w === 'unproductive') unproductive += span;
      else sleep += span;
    }
    if (ev.delta === 1) active.set(ev.id, ev.type);
    else active.delete(ev.id);
    prev = ev.t;
  }

  return { productive, neutral, unproductive, sleep, tracked };
}

export function calculateUntrackedTime(trackedMinutes: number): number {
  return Math.max(0, MINUTES_PER_DAY - trackedMinutes);
}

/**
 * Productivity = productive / wakingTime × 100.
 * Waking time = 24h − sleep (untracked is still "waking").
 */
export function calculateProductivity(productiveMinutes: number, sleepMinutes: number): number {
  const waking = Math.max(0, MINUTES_PER_DAY - sleepMinutes);
  if (waking === 0) return 0;
  return Math.min(100, (productiveMinutes / waking) * 100);
}

export function calculateGoalProgress(goal: Goal, activities: Activity[]): number {
  const relevant = activities.filter((a) => {
    if (goal.category && a.category !== goal.category) return false;
    if (goal.period === 'daily') return a.date === goal.date;
    if (goal.period === 'weekly') {
      const ws = startOfWeek(goal.date);
      const we = endOfWeek(goal.date);
      return a.date >= ws && a.date <= we;
    }
    const ms = startOfMonth(goal.date);
    const me = endOfMonth(goal.date);
    return a.date >= ms && a.date <= me;
  });

  // Prefer productive time toward goals unless category-specific (then any matching)
  const minutes = relevant
    .filter((a) => (goal.category ? true : a.type === 'productive'))
    .reduce((sum, a) => sum + a.durationMinutes, 0);

  if (goal.targetMinutes <= 0) return 0;
  return Math.min(100, (minutes / goal.targetMinutes) * 100);
}

export function getCategoryColor(name: string): string {
  return CATEGORIES.find((c) => c.name === name)?.color ?? '#6b7280';
}

export function getCategoryDefaultType(name: string): ActivityType {
  return CATEGORIES.find((c) => c.name === name)?.defaultType ?? 'neutral';
}

export function calculateDailyStats(activities: Activity[], date: string): DailyStats {
  const dayActivities = activities.filter(
    (a) => a.date === date || overlapsDay(a, date),
  );

  // Attribute: for stats on `date`, use intervals clipped to that day when possible,
  // but always include activities whose primary date is this day.
  const primary = activities.filter((a) => a.date === date);
  const intervals = primary
    .map((a) => {
      const start = parseTimeToMinutes(a.startTime);
      return {
        id: a._id,
        name: a.name,
        type: a.type,
        category: a.category,
        startAbs: start,
        endAbs: start + a.durationMinutes,
      } satisfies AbsoluteInterval;
    });

  const merged = mergeByPriority(intervals);
  const overlaps = detectOverlappingActivities(primary, date);
  const untracked = calculateUntrackedTime(merged.tracked);
  const waking = Math.max(0, MINUTES_PER_DAY - merged.sleep);
  const productivityPercent = calculateProductivity(merged.productive, merged.sleep);

  const catMap = new Map<string, number>();
  for (const a of primary) {
    // Category chart uses logged durations (with overlap warning separately)
    catMap.set(a.category, (catMap.get(a.category) ?? 0) + a.durationMinutes);
  }

  const categoryBreakdown: CategoryBreakdownItem[] = [...catMap.entries()]
    .map(([category, minutes]) => ({
      category,
      minutes,
      color: getCategoryColor(category),
      type: getCategoryDefaultType(category),
    }))
    .sort((a, b) => b.minutes - a.minutes);

  const typeBreakdown: TypeBreakdown = {
    productive: merged.productive,
    neutral: merged.neutral,
    unproductive: merged.unproductive,
    sleep: merged.sleep,
    untracked,
  };

  return {
    date,
    totalTrackedMinutes: merged.tracked,
    productiveMinutes: merged.productive,
    neutralMinutes: merged.neutral,
    unproductiveMinutes: merged.unproductive,
    sleepMinutes: merged.sleep,
    untrackedMinutes: untracked,
    wakingMinutes: waking,
    productivityPercent,
    categoryBreakdown,
    typeBreakdown,
    hasOverlaps: overlaps.length > 0,
    overlaps,
    activityCount: primary.length,
  };
}

export function calculateWeeklyStats(activities: Activity[], anchorDate: string): RangeStats {
  const start = startOfWeek(anchorDate);
  const end = endOfWeek(anchorDate);
  return calculateRangeStats(activities, start, end);
}

export function calculateMonthlyStats(activities: Activity[], anchorDate: string): RangeStats {
  const start = startOfMonth(anchorDate);
  const end = endOfMonth(anchorDate);
  return calculateRangeStats(activities, start, end);
}

export function calculateRangeStats(
  activities: Activity[],
  startDate: string,
  endDate: string,
): RangeStats {
  const days = eachDateInRange(startDate, endDate).map((d) => calculateDailyStats(activities, d));

  const catMap = new Map<string, { minutes: number; color: string; type: ActivityType }>();
  let productive = 0;
  let neutral = 0;
  let unproductive = 0;
  let sleep = 0;
  let tracked = 0;
  let untracked = 0;
  let waking = 0;
  let activityCount = 0;
  let hasOverlaps = false;
  let prodSum = 0;
  let prodDays = 0;

  for (const d of days) {
    productive += d.productiveMinutes;
    neutral += d.neutralMinutes;
    unproductive += d.unproductiveMinutes;
    sleep += d.sleepMinutes;
    tracked += d.totalTrackedMinutes;
    untracked += d.untrackedMinutes;
    waking += d.wakingMinutes;
    activityCount += d.activityCount;
    hasOverlaps = hasOverlaps || d.hasOverlaps;
    if (d.activityCount > 0) {
      prodSum += d.productivityPercent;
      prodDays++;
    }
    for (const c of d.categoryBreakdown) {
      const prev = catMap.get(c.category);
      if (prev) prev.minutes += c.minutes;
      else catMap.set(c.category, { minutes: c.minutes, color: c.color, type: c.type });
    }
  }

  const dayCount = Math.max(1, days.length);
  const avgProductivity =
    prodDays > 0 ? prodSum / prodDays : calculateProductivity(productive / dayCount, sleep / dayCount);

  return {
    startDate,
    endDate,
    days,
    totals: {
      totalTrackedMinutes: tracked,
      productiveMinutes: productive,
      neutralMinutes: neutral,
      unproductiveMinutes: unproductive,
      sleepMinutes: sleep,
      untrackedMinutes: untracked,
      wakingMinutes: waking,
      productivityPercent: avgProductivity,
      typeBreakdown: {
        productive,
        neutral,
        unproductive,
        sleep,
        untracked,
      },
      activityCount,
      hasOverlaps,
      avgProductivityPercent: avgProductivity,
      categoryBreakdown: [...catMap.entries()]
        .map(([category, v]) => ({ category, ...v }))
        .sort((a, b) => b.minutes - a.minutes),
    },
  };
}

export function greetingForNow(date = new Date()): string {
  const h = date.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function formatDisplayDate(dateKey: string): string {
  const d = parseDateKey(dateKey);
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/** 24-char hex id compatible with MongoDB ObjectId. */
export function createObjectId(): string {
  const bytes = new Uint8Array(12);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 12; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  const time = Math.floor(Date.now() / 1000);
  bytes[0] = (time >> 24) & 0xff;
  bytes[1] = (time >> 16) & 0xff;
  bytes[2] = (time >> 8) & 0xff;
  bytes[3] = time & 0xff;
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
