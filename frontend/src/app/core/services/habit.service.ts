import { Injectable, computed, inject, signal } from '@angular/core';
import { Habit } from '../models';
import { STORAGE_KEYS } from '../constants/categories';
import { LocalStoreService } from './local-store.service';
import { addDays, createId, todayKey } from '../utils/stats.utils';

export interface HabitInput {
  name: string;
  description?: string;
  targetDaysPerWeek: number;
  color?: string;
}

@Injectable({ providedIn: 'root' })
export class HabitService {
  private readonly store = inject(LocalStoreService);
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

  create(input: HabitInput): Habit {
    const now = new Date().toISOString();
    const habit: Habit = {
      _id: createId(),
      name: input.name.trim(),
      description: input.description?.trim() || undefined,
      targetDaysPerWeek: Math.min(7, Math.max(1, input.targetDaysPerWeek)),
      completedDates: [],
      color: input.color || '#0d9488',
      createdAt: now,
      updatedAt: now,
    };
    this._habits.update((list) => [...list, habit]);
    this.persist();
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
    this.persist();
    return updated;
  }

  delete(id: string): boolean {
    const before = this._habits().length;
    this._habits.update((list) => list.filter((h) => h._id !== id));
    this.persist();
    return this._habits().length < before;
  }

  toggleComplete(id: string, date = todayKey()): void {
    this._habits.update((list) =>
      list.map((h) => {
        if (h._id !== id) return h;
        const has = h.completedDates.includes(date);
        const completedDates = has
          ? h.completedDates.filter((d) => d !== date)
          : [...h.completedDates, date].sort();
        return { ...h, completedDates, updatedAt: new Date().toISOString() };
      }),
    );
    this.persist();
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

  replaceAll(habits: Habit[]): void {
    this._habits.set(habits);
    this.persist();
  }

  clearAll(): void {
    this._habits.set([]);
    this.persist();
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

  private persist(): void {
    // API swap: /api/habits
    this.store.set(STORAGE_KEYS.habits, this._habits());
  }
}
