import { Injectable, inject, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, finalize, switchMap, tap } from 'rxjs/operators';
import { STORAGE_KEYS } from '../constants/categories';
import { Activity, AppSettings, Goal, Habit } from '../models';
import { GritProgress } from '../data/grit-catalog';
import { ActivityService } from './activity.service';
import { GoalService } from './goal.service';
import { GritService } from './grit.service';
import { HabitService } from './habit.service';
import { LocalStoreService } from './local-store.service';
import { SettingsService } from './settings.service';
import { ThemeService } from './theme.service';
import { ToastService } from './toast.service';
import { ImportPayload, TrackerApiService, TrackerSnapshot } from './tracker-api.service';
import { apiErrorMessage } from '../utils/api-error';

@Injectable({ providedIn: 'root' })
export class DataSyncService {
  private readonly api = inject(TrackerApiService);
  private readonly store = inject(LocalStoreService);
  private readonly activities = inject(ActivityService);
  private readonly goals = inject(GoalService);
  private readonly habits = inject(HabitService);
  private readonly grit = inject(GritService);
  private readonly settings = inject(SettingsService);
  private readonly theme = inject(ThemeService);
  private readonly toast = inject(ToastService);

  private readonly _loading = signal(false);
  readonly loading = this._loading.asReadonly();

  hydrate(): Observable<TrackerSnapshot | null> {
    this._loading.set(true);
    return this.api.getSnapshot().pipe(
      switchMap((snap) => this.maybeMigrate(snap)),
      tap((snap) => this.applySnapshot(snap)),
      catchError((err) => {
        this.toast.error(apiErrorMessage(err, 'Could not load your data'));
        return of(null);
      }),
      finalize(() => this._loading.set(false)),
    );
  }

  resetLocal(): void {
    this.activities.hydrate([]);
    this.goals.hydrate([]);
    this.habits.hydrate([]);
    this.grit.resetLocal();
    this.settings.resetLocal();
  }

  clearAll(): void {
    this.resetLocal();
    this.api.clearAll().subscribe({
      next: () => this.toast.success('All tracker data cleared from your account'),
      error: (err) => this.toast.error(apiErrorMessage(err, 'Could not clear data')),
    });
  }

  importSample(payload: ImportPayload): void {
    this.api.importSnapshot(payload).subscribe({
      next: () => {
        this.hydrate().subscribe();
      },
      error: (err) => this.toast.error(apiErrorMessage(err, 'Could not load sample data')),
    });
  }

  private applySnapshot(snap: TrackerSnapshot): void {
    this.activities.hydrate(snap.activities ?? []);
    this.goals.hydrate(snap.goals ?? []);
    this.habits.hydrate(snap.habits ?? []);
    if (Array.isArray(snap.grit)) this.grit.hydrate(snap.grit);
    this.settings.hydrate(snap.settings);
    const theme = snap.settings?.theme;
    if (theme) this.theme.setMode(theme);
  }

  private maybeMigrate(snap: TrackerSnapshot): Observable<TrackerSnapshot> {
    const cloudEmpty =
      (snap.activities?.length ?? 0) === 0 &&
      (snap.goals?.length ?? 0) === 0 &&
      (snap.habits?.length ?? 0) === 0 &&
      (snap.grit?.length ?? 0) === 0;
    if (!cloudEmpty || this.store.get(this.migratedKey(), false)) {
      return this.maybeMigrateGrit(snap);
    }

    const local = this.readLegacy();
    const hasLegacy =
      (local.activities?.length ?? 0) > 0 ||
      (local.goals?.length ?? 0) > 0 ||
      (local.habits?.length ?? 0) > 0 ||
      (local.grit?.length ?? 0) > 0;
    if (!hasLegacy) {
      this.store.set(this.migratedKey(), true);
      return of(snap);
    }

    return this.api.importSnapshot(local).pipe(
      tap(() => {
        this.store.set(this.migratedKey(), true);
        this.clearLegacy();
      }),
      switchMap(() => this.api.getSnapshot()),
      catchError((err) => {
        this.toast.error(apiErrorMessage(err, 'Could not migrate local data'));
        return of(snap);
      }),
    );
  }

  private maybeMigrateGrit(snap: TrackerSnapshot): Observable<TrackerSnapshot> {
    if ((snap.grit?.length ?? 0) > 0) return of(snap);
    const grit = this.store.get<GritProgress[]>(STORAGE_KEYS.grit, []);
    if (!grit.length) return of(snap);
    return this.api.importSnapshot({ grit }).pipe(
      switchMap(() => this.api.getSnapshot()),
      catchError(() => of(snap)),
    );
  }

  private migratedKey(): string {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.auth);
      const id = raw ? JSON.parse(raw)?.user?.id : null;
      return id ? `${STORAGE_KEYS.cloudMigrated}.${id}` : STORAGE_KEYS.cloudMigrated;
    } catch {
      return STORAGE_KEYS.cloudMigrated;
    }
  }

  private readLegacy(): ImportPayload {
    const activities = this.store.get<Activity[]>(STORAGE_KEYS.activities, []);
    const goals = this.store.get<Goal[]>(STORAGE_KEYS.goals, []);
    const habits = this.store.get<Habit[]>(STORAGE_KEYS.habits, []);
    const settings = this.store.get<Partial<AppSettings>>(STORAGE_KEYS.settings, {});
    const grit = this.store.get<GritProgress[]>(STORAGE_KEYS.grit, []);
    return {
      activities: activities.map(({ _id: _unused, createdAt: _c, updatedAt: _u, ...rest }) => rest),
      goals: goals.map(({ _id: _unused, createdAt: _c, updatedAt: _u, ...rest }) => rest),
      habits: habits.map(({ _id: _unused, createdAt: _c, updatedAt: _u, ...rest }) => rest),
      settings,
      grit,
    };
  }

  private clearLegacy(): void {
    this.store.remove(STORAGE_KEYS.activities);
    this.store.remove(STORAGE_KEYS.goals);
    this.store.remove(STORAGE_KEYS.habits);
    this.store.remove(STORAGE_KEYS.grit);
  }
}
