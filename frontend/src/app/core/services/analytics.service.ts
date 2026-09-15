import { Injectable, computed, inject } from '@angular/core';
import { ActivityService } from './activity.service';
import { DateNavService } from './date-nav.service';
import {
  calculateDailyStats,
  calculateMonthlyStats,
  calculateRangeStats,
  calculateWeeklyStats,
} from '../utils/stats.utils';

/**
 * Derived analytics — no persistence of its own.
 * Future: optional server-side aggregation endpoints.
 */
@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly activities = inject(ActivityService);
  private readonly dates = inject(DateNavService);

  readonly selectedDayStats = computed(() =>
    calculateDailyStats(this.activities.activities(), this.dates.selectedDate()),
  );

  readonly selectedRangeStats = computed(() =>
    calculateRangeStats(
      this.activities.activities(),
      this.dates.rangeStart(),
      this.dates.rangeEnd(),
    ),
  );

  daily(date: string) {
    return calculateDailyStats(this.activities.activities(), date);
  }

  weekly(anchor: string) {
    return calculateWeeklyStats(this.activities.activities(), anchor);
  }

  monthly(anchor: string) {
    return calculateMonthlyStats(this.activities.activities(), anchor);
  }

  range(start: string, end: string) {
    return calculateRangeStats(this.activities.activities(), start, end);
  }

  insightsFor(date: string): string[] {
    const stats = this.daily(date);
    const insights: string[] = [];

    if (stats.activityCount === 0) {
      return [];
    }

    if (stats.hasOverlaps) {
      insights.push(
        `${stats.overlaps.length} overlapping activit${stats.overlaps.length === 1 ? 'y' : 'ies'} detected — totals use merged time to avoid double-counting.`,
      );
    }

    if (stats.productivityPercent >= 60) {
      insights.push(`Strong day — productivity at ${Math.round(stats.productivityPercent)}%.`);
    } else if (stats.productiveMinutes > 0 && stats.productivityPercent < 25) {
      insights.push('Productive time is low relative to waking hours. Consider blocking focus time.');
    }

    const top = stats.categoryBreakdown[0];
    if (top) {
      insights.push(`Most time went to ${top.category}.`);
    }

    if (stats.untrackedMinutes > 8 * 60) {
      insights.push('Large untracked portion — untracked is not unproductive, just not logged.');
    }

    if (stats.sleepMinutes > 0 && stats.sleepMinutes < 6 * 60) {
      insights.push('Sleep looks short vs a typical 7–8h target.');
    }

    return insights;
  }
}
