import { Injectable, computed, inject } from '@angular/core';
import { SleepSummary } from '../models';
import { DEFAULT_SLEEP_TARGET_MINUTES } from '../constants/categories';
import { ActivityService } from './activity.service';
import { SettingsService } from './settings.service';
import { addDays, calculateDailyStats } from '../utils/stats.utils';

/**
 * Sleep derived from Sleep-category activities + settings target.
 * Overnight duration is already computed on the Activity.
 */
@Injectable({ providedIn: 'root' })
export class SleepService {
  private readonly activities = inject(ActivityService);
  private readonly settings = inject(SettingsService);

  summaryFor(date: string): SleepSummary {
    const day = calculateDailyStats(this.activities.activities(), date);
    const target = this.settings.settings().sleepTargetMinutes || DEFAULT_SLEEP_TARGET_MINUTES;
    const sleepActs = this.activities
      .getByDate(date)
      .filter((a) => a.type === 'sleep' || a.category === 'Sleep');
    const duration = day.sleepMinutes;
    const weekly = this.weeklyAverage(date);

    return {
      date,
      durationMinutes: duration,
      targetMinutes: target,
      deficitMinutes: duration - target,
      weeklyAverageMinutes: weekly,
      activityId: sleepActs[0]?._id,
    };
  }

  readonly targetMinutes = computed(
    () => this.settings.settings().sleepTargetMinutes || DEFAULT_SLEEP_TARGET_MINUTES,
  );

  private weeklyAverage(anchor: string): number {
    let total = 0;
    let daysWith = 0;
    for (let i = 0; i < 7; i++) {
      const d = addDays(anchor, -i);
      const mins = calculateDailyStats(this.activities.activities(), d).sleepMinutes;
      if (mins > 0) {
        total += mins;
        daysWith++;
      }
    }
    return daysWith === 0 ? 0 : Math.round(total / daysWith);
  }
}
