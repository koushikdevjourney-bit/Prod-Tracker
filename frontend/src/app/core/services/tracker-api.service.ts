import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Activity, ActivityType, AppSettings, Goal, GoalPeriod, Habit } from '../models';
import { GritProgress } from '../data/grit-catalog';
import { AcademicTrack } from '../data/academic-catalog';
import { ProgressState } from '../data/progress-catalog';

export interface ActivityPayload {
  _id?: string;
  name: string;
  category: string;
  date: string;
  startTime: string;
  endTime: string;
  endDate?: string;
  type: ActivityType;
  notes?: string;
}

export interface GoalPayload {
  _id?: string;
  name: string;
  category?: string;
  targetMinutes: number;
  date: string;
  period: GoalPeriod;
}

export interface HabitPayload {
  _id?: string;
  name: string;
  description?: string;
  targetDaysPerWeek: number;
  color?: string;
  completedDates?: string[];
}

export interface TrackerSnapshot {
  activities: Activity[];
  goals: Goal[];
  habits: Habit[];
  settings: AppSettings;
  grit: GritProgress[];
  academics: AcademicTrack[];
  progress: ProgressState;
}

export interface ImportPayload {
  activities?: ActivityPayload[];
  goals?: GoalPayload[];
  habits?: HabitPayload[];
  settings?: Partial<AppSettings>;
  grit?: GritProgress[];
  academics?: AcademicTrack[];
  progress?: ProgressState;
}

@Injectable({ providedIn: 'root' })
export class TrackerApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  getSnapshot(): Observable<TrackerSnapshot> {
    return this.http.get<TrackerSnapshot>(`${this.base}/data`);
  }

  clearAll(): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.base}/data`);
  }

  importSnapshot(payload: ImportPayload): Observable<TrackerSnapshot> {
    return this.http.post<TrackerSnapshot>(`${this.base}/data/import`, payload);
  }

  createActivity(payload: ActivityPayload): Observable<Activity> {
    return this.http.post<Activity>(`${this.base}/activities`, payload);
  }

  updateActivity(id: string, payload: ActivityPayload): Observable<Activity> {
    return this.http.put<Activity>(`${this.base}/activities/${id}`, payload);
  }

  deleteActivity(id: string): Observable<Activity> {
    return this.http.delete<Activity>(`${this.base}/activities/${id}`);
  }

  createGoal(payload: GoalPayload): Observable<Goal> {
    return this.http.post<Goal>(`${this.base}/goals`, payload);
  }

  updateGoal(id: string, payload: GoalPayload): Observable<Goal> {
    return this.http.put<Goal>(`${this.base}/goals/${id}`, payload);
  }

  deleteGoal(id: string): Observable<Goal> {
    return this.http.delete<Goal>(`${this.base}/goals/${id}`);
  }

  createHabit(payload: HabitPayload): Observable<Habit> {
    return this.http.post<Habit>(`${this.base}/habits`, payload);
  }

  updateHabit(id: string, payload: HabitPayload): Observable<Habit> {
    return this.http.put<Habit>(`${this.base}/habits/${id}`, payload);
  }

  toggleHabit(id: string, date: string): Observable<Habit> {
    return this.http.patch<Habit>(`${this.base}/habits/${id}/toggle`, { date });
  }

  deleteHabit(id: string): Observable<Habit> {
    return this.http.delete<Habit>(`${this.base}/habits/${id}`);
  }

  updateSettings(payload: Partial<AppSettings>): Observable<AppSettings> {
    return this.http.put<AppSettings>(`${this.base}/settings`, payload);
  }

  saveGrit(rows: GritProgress[]): Observable<GritProgress[]> {
    return this.http
      .put<{ rows: GritProgress[] }>(`${this.base}/grit`, { rows })
      .pipe(map((res) => res.rows ?? rows));
  }

  saveAcademics(tracks: AcademicTrack[]): Observable<AcademicTrack[]> {
    return this.http
      .put<{ tracks: AcademicTrack[] }>(`${this.base}/academics`, { tracks })
      .pipe(map((res) => res.tracks ?? tracks));
  }

  saveProgress(state: ProgressState): Observable<ProgressState> {
    return this.http.put<ProgressState>(`${this.base}/progress`, state);
  }
}
