import { Injectable, computed, inject, signal } from '@angular/core';
import { STORAGE_KEYS } from '../constants/categories';
import {
  GRIT_LEVELS,
  GRIT_MAX_MILES,
  GRIT_SUBJECT_COUNT,
  GritProgress,
  GritResult,
  GritSubjectDef,
  GritTarget,
  milesForResult,
} from '../data/grit-catalog';
import { LocalStoreService } from './local-store.service';
import { TrackerApiService } from './tracker-api.service';
import { ToastService } from './toast.service';
import { apiErrorMessage } from '../utils/api-error';
import { createId } from '../utils/stats.utils';

@Injectable({ providedIn: 'root' })
export class GritService {
  private readonly store = inject(LocalStoreService);
  private readonly api = inject(TrackerApiService);
  private readonly toast = inject(ToastService);
  private readonly _rows = signal<GritProgress[]>(
    this.store.get<GritProgress[]>(STORAGE_KEYS.grit, []),
  );
  private persistTimer: ReturnType<typeof setTimeout> | null = null;

  readonly rows = this._rows.asReadonly();

  readonly totals = computed(() => {
    let miles = 0;
    let cleared = 0;
    let gold = 0;
    for (const level of GRIT_LEVELS) {
      for (const subject of level.subjects) {
        const result = this.resultOf(level.level, subject.subject);
        miles += milesForResult(subject, result);
        if (result === 'gold' || result === 'silver') cleared++;
        if (result === 'gold') gold++;
      }
    }
    return {
      miles,
      cleared,
      gold,
      subjectCount: GRIT_SUBJECT_COUNT,
      maxMiles: GRIT_MAX_MILES,
      percent: Math.round((miles / GRIT_MAX_MILES) * 100),
    };
  });

  hydrate(rows: GritProgress[]): void {
    this._rows.set(rows ?? []);
    this.store.set(STORAGE_KEYS.grit, this._rows());
  }

  resetLocal(): void {
    this._rows.set([]);
    this.store.remove(STORAGE_KEYS.grit);
  }

  resultOf(level: number, subject: string): GritResult {
    return this.find(level, subject)?.result ?? 'none';
  }

  find(level: number, subject: string): GritProgress | undefined {
    return this._rows().find((r) => r.level === level && r.subject === subject);
  }

  climbFor(level: number): GritProgress[] {
    return this._rows()
      .filter((r) => r.level === level && r.inClimb)
      .sort((a, b) => a.position - b.position);
  }

  availableForClimb(level: number, subjects: GritSubjectDef[]): GritSubjectDef[] {
    const climb = this.climbFor(level);
    return subjects.filter((s) => {
      const row = this.find(level, s.subject);
      const result = row?.result ?? 'none';
      return result === 'none' && !climb.some((c) => c.subject === s.subject);
    });
  }

  openSubjects(level: number, subjects: GritSubjectDef[]): GritSubjectDef[] {
    return subjects.filter((s) => this.resultOf(level, s.subject) === 'none');
  }

  completedSubjects(level: number, subjects: GritSubjectDef[]): Array<GritSubjectDef & { result: GritResult }> {
    return subjects
      .map((s) => ({ ...s, result: this.resultOf(level, s.subject) }))
      .filter((s) => s.result !== 'none');
  }

  levelStats(level: number, subjects: GritSubjectDef[]) {
    let miles = 0;
    let cleared = 0;
    for (const s of subjects) {
      const result = this.resultOf(level, s.subject);
      miles += milesForResult(s, result);
      if (result === 'gold' || result === 'silver') cleared++;
    }
    return { miles, cleared, total: subjects.length };
  }

  mark(level: number, subject: string, result: GritResult): void {
    const current = this.resultOf(level, subject);
    const next = current === result ? 'none' : result;
    this.upsert(level, subject, { result: next });
  }

  setTarget(level: number, subject: string, target: GritTarget): void {
    this.upsert(level, subject, { target });
  }

  addToClimb(level: number, subject: string): void {
    if (!subject) return;
    const climb = this.climbFor(level);
    if (climb.some((c) => c.subject === subject)) return;
    this.upsert(level, subject, { inClimb: true, position: climb.length, target: 'gold' });
  }

  removeFromClimb(level: number, subject: string): void {
    this.upsert(level, subject, { inClimb: false });
    this.reindexClimb(level);
  }

  reorderClimb(level: number, draggedId: string, overId: string): void {
    if (!draggedId || draggedId === overId) return;
    const ids = this.climbFor(level).map((r) => r.id);
    const from = ids.indexOf(draggedId);
    const to = ids.indexOf(overId);
    if (from < 0 || to < 0) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    this._rows.update((list) =>
      list.map((row) => {
        const idx = ids.indexOf(row.id);
        return idx >= 0 ? { ...row, position: idx } : row;
      }),
    );
    this.persist();
  }

  private upsert(level: number, subject: string, patch: Partial<GritProgress>): void {
    const existing = this.find(level, subject);
    if (existing) {
      this._rows.update((list) =>
        list.map((r) => (r.id === existing.id ? { ...r, ...patch } : r)),
      );
    } else {
      const row: GritProgress = {
        id: createId(),
        level,
        subject,
        result: 'none',
        target: 'gold',
        inClimb: false,
        position: 0,
        ...patch,
      };
      this._rows.update((list) => [...list, row]);
    }
    this.persist();
  }

  private reindexClimb(level: number): void {
    const ordered = this.climbFor(level);
    this._rows.update((list) =>
      list.map((row) => {
        const idx = ordered.findIndex((c) => c.id === row.id);
        return idx >= 0 ? { ...row, position: idx } : row;
      }),
    );
    this.persist();
  }

  private persist(): void {
    this.store.set(STORAGE_KEYS.grit, this._rows());
    if (!this.hasSession()) return;
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      this.api.saveGrit(this._rows()).subscribe({
        error: (err) => this.toast.error(apiErrorMessage(err, 'Could not save grit progress')),
      });
    }, 400);
  }

  private hasSession(): boolean {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.auth);
      if (!raw) return false;
      return Boolean(JSON.parse(raw)?.token);
    } catch {
      return false;
    }
  }
}

export { milesForResult };
