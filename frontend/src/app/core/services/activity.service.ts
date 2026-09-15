import { Injectable, computed, inject, signal } from '@angular/core';
import { Activity, ActivityType } from '../models';
import { STORAGE_KEYS } from '../constants/categories';
import { LocalStoreService } from './local-store.service';
import {
  addDays,
  calculateDuration,
  createId,
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
 * Activity CRUD — localStorage persistence.
 * Future swap: replace LocalStoreService calls with HttpClient → Express API.
 */
@Injectable({ providedIn: 'root' })
export class ActivityService {
  private readonly store = inject(LocalStoreService);
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
      _id: createId(),
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
    this.persist();
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
    this.persist();
    return updated;
  }

  delete(id: string): boolean {
    const before = this._activities().length;
    this._activities.update((list) => list.filter((a) => a._id !== id));
    this.persist();
    return this._activities().length < before;
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

  replaceAll(activities: Activity[]): void {
    this._activities.set(activities);
    this.persist();
  }

  clearAll(): void {
    this._activities.set([]);
    this.persist();
  }

  private resolveEndDate(input: ActivityInput): string | undefined {
    if (input.endDate && input.endDate !== input.date) return input.endDate;
    if (parseTimeToMinutes(input.endTime) <= parseTimeToMinutes(input.startTime)) {
      return addDays(input.date, 1);
    }
    return undefined;
  }

  private persist(): void {
    // API swap: POST/PUT/DELETE /api/activities
    this.store.set(STORAGE_KEYS.activities, this._activities());
  }
}
