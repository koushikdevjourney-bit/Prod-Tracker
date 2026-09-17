import { Injectable, computed, inject, signal } from '@angular/core';
import { Goal, GoalPeriod } from '../models';
import { STORAGE_KEYS } from '../constants/categories';
import { ActivityService } from './activity.service';
import { LocalStoreService } from './local-store.service';
import { TrackerApiService } from './tracker-api.service';
import { calculateGoalProgress, createObjectId } from '../utils/stats.utils';
import { ToastService } from './toast.service';
import { apiErrorMessage } from '../utils/api-error';

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
  private readonly api = inject(TrackerApiService);
  private readonly activities = inject(ActivityService);
  private readonly toast = inject(ToastService);
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

  hydrate(goals: Goal[]): void {
    this._goals.set(goals ?? []);
    this.persistLocal();
  }

  create(input: GoalInput): Goal {
    const now = new Date().toISOString();
    const goal: Goal = {
      _id: createObjectId(),
      name: input.name.trim(),
      category: input.category || undefined,
      targetMinutes: Math.max(1, Math.round(input.targetMinutes)),
      date: input.date,
      period: input.period,
      createdAt: now,
      updatedAt: now,
    };
    this._goals.update((list) => [...list, goal]);
    this.persistLocal();
    this.api.createGoal({ ...input, _id: goal._id, category: goal.category }).subscribe({
      next: (saved) => {
        this.replaceOne(goal._id, saved);
        this.persistLocal();
      },
      error: (err) => this.toast.error(apiErrorMessage(err, 'Could not save goal')),
    });
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
    this.persistLocal();
    this.api.updateGoal(id, { ...input, category: updated.category }).subscribe({
      next: (saved) => {
        this.replaceOne(id, saved);
        this.persistLocal();
      },
      error: (err) => this.toast.error(apiErrorMessage(err, 'Could not save goal')),
    });
    return updated;
  }

  delete(id: string): boolean {
    const existing = this._goals().find((g) => g._id === id);
    if (!existing) return false;
    this._goals.update((list) => list.filter((g) => g._id !== id));
    this.persistLocal();
    this.api.deleteGoal(id).subscribe({
      error: (err) => this.toast.error(apiErrorMessage(err, 'Could not delete goal')),
    });
    return true;
  }

  private loggedMinutes(goal: Goal): number {
    const pct = calculateGoalProgress(goal, this.activities.activities());
    return Math.round((pct / 100) * goal.targetMinutes);
  }

  private persistLocal(): void {
    this.store.set(STORAGE_KEYS.goals, this._goals());
  }

  private replaceOne(id: string, saved: Goal): void {
    this._goals.update((list) => list.map((g) => (g._id === id ? saved : g)));
  }
}
