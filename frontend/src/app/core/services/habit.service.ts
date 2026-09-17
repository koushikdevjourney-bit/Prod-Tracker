import { Injectable, computed, inject, signal } from '@angular/core';
import { Habit } from '../models';
import { STORAGE_KEYS } from '../constants/categories';
import { LocalStoreService } from './local-store.service';
import { TrackerApiService } from './tracker-api.service';
import { addDays, createObjectId, todayKey } from '../utils/stats.utils';
import { ToastService } from './toast.service';
import { apiErrorMessage } from '../utils/api-error';

export interface HabitInput {
  name: string;
  description?: string;
  targetDaysPerWeek: number;
  color?: string;
}

@Injectable({ providedIn: 'root' })
export class HabitService {
  private readonly store = inject(LocalStoreService);
  private readonly api = inject(TrackerApiService);
  private readonly toast = inject(ToastService);
  private readonly _habits = signal<Habit[]>(this.store.get<Habit[]>(STORAGE_KEYS.habits, []));

  readonly habits = this._habits.asReadonly();

  readonly withStreaks = computed(() =>
    this._habits().map((h) => ({
      habit: h,
      streak: this.calculateStreak(h),
      completedToday: h.completedDates.includes(todayKey()),
      weekCount: this.weekCompletionCount(h),
    })),
  );

  hydrate(habits: Habit[]): void {
    this._habits.set(habits ?? []);
    this.persistLocal();
  }

  create(input: HabitInput): Habit {
    const now = new Date().toISOString();
    const habit: Habit = {
      _id: createObjectId(),
      name: input.name.trim(),
      description: input.description?.trim() || undefined,
      targetDaysPerWeek: Math.min(7, Math.max(1, input.targetDaysPerWeek)),
      completedDates: [],
      color: input.color || '#0d9488',
      createdAt: now,
      updatedAt: now,
    };
    this._habits.update((list) => [...list, habit]);
    this.persistLocal();
    this.api
      .createHabit({
        ...input,
        _id: habit._id,
        description: habit.description,
        completedDates: [],
      })
      .subscribe({
        next: (saved) => {
          this.replaceOne(habit._id, saved);
          this.persistLocal();
        },
        error: (err) => this.toast.error(apiErrorMessage(err, 'Could not save habit')),
      });
    return habit;
  }

  update(id: string, input: HabitInput): Habit | null {
    const existing = this._habits().find((h) => h._id === id);
    if (!existing) return null;
    const updated: Habit = {
      ...existing,
      name: input.name.trim(),
      description: input.description?.trim() || undefined,
      targetDaysPerWeek: Math.min(7, Math.max(1, input.targetDaysPerWeek)),
      color: input.color || existing.color,
      updatedAt: new Date().toISOString(),
    };
    this._habits.update((list) => list.map((h) => (h._id === id ? updated : h)));
    this.persistLocal();
    this.api
      .updateHabit(id, {
        ...input,
        description: updated.description,
        color: updated.color,
        completedDates: existing.completedDates,
      })
      .subscribe({
        next: (saved) => {
          this.replaceOne(id, saved);
          this.persistLocal();
        },
        error: (err) => this.toast.error(apiErrorMessage(err, 'Could not save habit')),
      });
    return updated;
  }

  delete(id: string): boolean {
    const existing = this._habits().find((h) => h._id === id);
    if (!existing) return false;
    this._habits.update((list) => list.filter((h) => h._id !== id));
    this.persistLocal();
    this.api.deleteHabit(id).subscribe({
      error: (err) => this.toast.error(apiErrorMessage(err, 'Could not delete habit')),
    });
    return true;
  }

  toggleComplete(id: string, date = todayKey()): void {
    const existing = this._habits().find((h) => h._id === id);
    if (!existing) return;
    const has = existing.completedDates.includes(date);
    const completedDates = has
      ? existing.completedDates.filter((d) => d !== date)
      : [...existing.completedDates, date].sort();
    this._habits.update((list) =>
      list.map((h) =>
        h._id === id ? { ...h, completedDates, updatedAt: new Date().toISOString() } : h,
      ),
    );
    this.persistLocal();
    this.api.toggleHabit(id, date).subscribe({
      next: (saved) => {
        this.replaceOne(id, saved);
        this.persistLocal();
      },
      error: (err) => this.toast.error(apiErrorMessage(err, 'Could not save habit')),
    });
  }

  calculateStreak(habit: Habit): number {
    const set = new Set(habit.completedDates);
    let streak = 0;
    let cursor = todayKey();
    if (!set.has(cursor)) {
      cursor = addDays(cursor, -1);
    }
    while (set.has(cursor)) {
      streak++;
      cursor = addDays(cursor, -1);
    }
    return streak;
  }

  private weekCompletionCount(habit: Habit): number {
    const today = todayKey();
    let count = 0;
    for (let i = 0; i < 7; i++) {
      const d = addDays(today, -i);
      if (habit.completedDates.includes(d)) count++;
    }
    return count;
  }

  private persistLocal(): void {
    this.store.set(STORAGE_KEYS.habits, this._habits());
  }

  private replaceOne(id: string, saved: Habit): void {
    this._habits.update((list) => list.map((h) => (h._id === id ? saved : h)));
  }
}
