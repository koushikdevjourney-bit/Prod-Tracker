import { Injectable, computed, inject, signal } from '@angular/core';
import { Goal, GoalPeriod } from '../models';
import { STORAGE_KEYS } from '../constants/categories';
import { LocalStoreService } from './local-store.service';
import { ActivityService } from './activity.service';
import { calculateGoalProgress, createId } from '../utils/stats.utils';

export interface GoalInput {
  name: string;
  category?: string;
  targetMinutes: number;
  date: string;
  period: GoalPeriod;
}

@Injectable({ providedIn: 'root' })
export class GoalService {
  private readonly store = inject(LocalStoreService);
  private readonly activities = inject(ActivityService);
  private readonly _goals = signal<Goal[]>(this.store.get<Goal[]>(STORAGE_KEYS.goals, []));

  readonly goals = this._goals.asReadonly();

  readonly withProgress = computed(() => {
    const activities = this.activities.activities();
    return this._goals().map((g) => ({
      goal: g,
      progressPercent: calculateGoalProgress(g, activities),
      loggedMinutes: this.loggedMinutes(g),
    }));
  });

  create(input: GoalInput): Goal {
    const now = new Date().toISOString();
    const goal: Goal = {
      _id: createId(),
      name: input.name.trim(),
      category: input.category || undefined,
      targetMinutes: Math.max(1, Math.round(input.targetMinutes)),
      date: input.date,
      period: input.period,
      createdAt: now,
      updatedAt: now,
    };
    this._goals.update((list) => [...list, goal]);
    this.persist();
    return goal;
  }

  update(id: string, input: GoalInput): Goal | null {
    const existing = this._goals().find((g) => g._id === id);
    if (!existing) return null;
    const updated: Goal = {
      ...existing,
      name: input.name.trim(),
      category: input.category || undefined,
      targetMinutes: Math.max(1, Math.round(input.targetMinutes)),
      date: input.date,
      period: input.period,
      updatedAt: new Date().toISOString(),
    };
    this._goals.update((list) => list.map((g) => (g._id === id ? updated : g)));
    this.persist();
    return updated;
  }

  delete(id: string): boolean {
    const before = this._goals().length;
    this._goals.update((list) => list.filter((g) => g._id !== id));
    this.persist();
    return this._goals().length < before;
  }

  replaceAll(goals: Goal[]): void {
    this._goals.set(goals);
    this.persist();
  }

  clearAll(): void {
    this._goals.set([]);
    this.persist();
  }

  private loggedMinutes(goal: Goal): number {
    const pct = calculateGoalProgress(goal, this.activities.activities());
    return Math.round((pct / 100) * goal.targetMinutes);
  }

  private persist(): void {
    // API swap: /api/goals
    this.store.set(STORAGE_KEYS.goals, this._goals());
  }
}
