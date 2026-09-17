import { Injectable, computed, inject, signal } from '@angular/core';
import { Activity, ActivityType } from '../models';
import { STORAGE_KEYS } from '../constants/categories';
import { LocalStoreService } from './local-store.service';
import { ToastService } from './toast.service';
import { TrackerApiService } from './tracker-api.service';
import { apiErrorMessage } from '../utils/api-error';
import {
  addDays,
  calculateDuration,
  createObjectId,
  detectOverlappingActivities,
  getCategoryDefaultType,
  parseTimeToMinutes,
} from '../utils/stats.utils';

export interface ActivityInput {
  name: string;
  category: string;
  date: string;
  startTime: string;
  endTime: string;
  endDate?: string;
  type: ActivityType;
  notes?: string;
}

/**
 * Activity CRUD — persisted per signed-in user via the API.
 */
@Injectable({ providedIn: 'root' })
export class ActivityService {
  private readonly store = inject(LocalStoreService);
  private readonly api = inject(TrackerApiService);
  private readonly toast = inject(ToastService);
  private readonly _activities = signal<Activity[]>(
    this.store.get<Activity[]>(STORAGE_KEYS.activities, []),
  );

  readonly activities = this._activities.asReadonly();

  readonly sorted = computed(() =>
    [...this._activities()].sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime);
    }),
  );

  hydrate(activities: Activity[]): void {
    this._activities.set(activities ?? []);
    this.persistLocal();
  }

  getByDate(date: string): Activity[] {
    return this.sorted().filter((a) => a.date === date);
  }

  getByRange(start: string, end: string): Activity[] {
    return this.sorted().filter((a) => a.date >= start && a.date <= end);
  }

  getById(id: string): Activity | undefined {
    return this._activities().find((a) => a._id === id);
  }

  overlapsFor(date: string, excludeId?: string) {
    const list = this.getByDate(date).filter((a) => a._id !== excludeId);
    return detectOverlappingActivities(list, date);
  }

  create(input: ActivityInput): Activity {
    const now = new Date().toISOString();
    const endDate = this.resolveEndDate(input);
    const durationMinutes = calculateDuration(
      input.startTime,
      input.endTime,
      input.date,
      endDate,
    );
    const activity: Activity = {
      _id: createObjectId(),
      name: input.name.trim(),
      category: input.category,
      date: input.date,
      startTime: input.startTime,
      endTime: input.endTime,
      endDate,
      durationMinutes,
      type: input.type || getCategoryDefaultType(input.category),
      notes: input.notes?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    };
    this._activities.update((list) => [...list, activity]);
    this.persistLocal();
    this.api.createActivity({ ...input, _id: activity._id, endDate, notes: activity.notes }).subscribe({
      next: (saved) => {
        this.replaceOne(activity._id, saved);
        this.persistLocal();
      },
      error: (err) => {
        if (this.shouldWarn(err)) this.toast.error(apiErrorMessage(err, 'Could not sync activity'));
      },
    });
    return activity;
  }

  update(id: string, input: ActivityInput): Activity | null {
    const existing = this.getById(id);
    if (!existing) return null;
    const endDate = this.resolveEndDate(input);
    const durationMinutes = calculateDuration(
      input.startTime,
      input.endTime,
      input.date,
      endDate,
    );
    const updated: Activity = {
      ...existing,
      name: input.name.trim(),
      category: input.category,
      date: input.date,
      startTime: input.startTime,
      endTime: input.endTime,
      endDate,
      durationMinutes,
      type: input.type || getCategoryDefaultType(input.category),
      notes: input.notes?.trim() || undefined,
      updatedAt: new Date().toISOString(),
    };
    this._activities.update((list) => list.map((a) => (a._id === id ? updated : a)));
    this.persistLocal();
    this.api.updateActivity(id, { ...input, endDate, notes: updated.notes }).subscribe({
      next: (saved) => {
        this.replaceOne(id, saved);
        this.persistLocal();
      },
      error: (err) => {
        if (this.shouldWarn(err)) this.toast.error(apiErrorMessage(err, 'Could not sync activity'));
      },
    });
    return updated;
  }

  delete(id: string): boolean {
    const existing = this.getById(id);
    if (!existing) return false;
    this._activities.update((list) => list.filter((a) => a._id !== id));
    this.persistLocal();
    this.api.deleteActivity(id).subscribe({
      error: (err) => {
        if (this.shouldWarn(err)) this.toast.error(apiErrorMessage(err, 'Could not sync delete'));
      },
    });
    return true;
  }

  duplicate(id: string): Activity | null {
    const src = this.getById(id);
    if (!src) return null;
    return this.create({
      name: `${src.name} (copy)`,
      category: src.category,
      date: src.date,
      startTime: src.startTime,
      endTime: src.endTime,
      endDate: src.endDate,
      type: src.type,
      notes: src.notes,
    });
  }

  private persistLocal(): void {
    this.store.set(STORAGE_KEYS.activities, this._activities());
  }

  private shouldWarn(err: unknown): boolean {
    return typeof err === 'object' && err !== null && 'status' in err && (err as { status: number }).status !== 404;
  }

  private replaceOne(id: string, saved: Activity): void {
    this._activities.update((list) => list.map((a) => (a._id === id ? saved : a)));
  }

  private resolveEndDate(input: ActivityInput): string | undefined {
    if (input.endDate && input.endDate !== input.date) return input.endDate;
    if (parseTimeToMinutes(input.endTime) <= parseTimeToMinutes(input.startTime)) {
      return addDays(input.date, 1);
    }
    return undefined;
  }
}
