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
    this.migrateLegacySubjects(this.store.get<GritProgress[]>(STORAGE_KEYS.grit, [])),
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
        if (result !== 'none') cleared++;
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
    const migrated = this.migrateLegacySubjects(rows ?? []);
    const normalized = this.normalizePositions(migrated);
    this._rows.set(normalized);
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

  overallClimb(): GritProgress[] {
    return this._rows()
      .filter((r) => r.inClimb)
      .sort((a, b) => a.position - b.position);
  }

  climbFor(level: number): GritProgress[] {
    return this._rows()
      .filter((r) => r.level === level && r.inClimb)
      .sort((a, b) => a.position - b.position);
  }

  availableForClimb(level: number, subjects: GritSubjectDef[]): GritSubjectDef[] {
    return subjects.filter((s) => {
      const row = this.find(level, s.subject);
      const result = row?.result ?? 'none';
      return result === 'none' && !row?.inClimb;
    });
  }

  availableForOverallClimb(): Array<GritSubjectDef & { level: number }> {
    const list: Array<GritSubjectDef & { level: number }> = [];
    for (const lvl of GRIT_LEVELS) {
      for (const s of lvl.subjects) {
        const row = this.find(lvl.level, s.subject);
        const result = row?.result ?? 'none';
        if (result === 'none' && !row?.inClimb) {
          list.push({ ...s, level: lvl.level });
        }
      }
    }
    return list;
  }

  openSubjects(level: number, subjects: GritSubjectDef[]): GritSubjectDef[] {
    return subjects.filter((s) => this.resultOf(level, s.subject) === 'none');
  }

  completedSubjects(level: number, subjects: GritSubjectDef[]): Array<GritSubjectDef & { result: GritResult }> {
    return subjects
      .map((s) => ({ ...s, result: this.resultOf(level, s.subject) }))
      .filter((s) => s.result !== 'none');
  }

  openSubjectsOverall(): Array<GritSubjectDef & { level: number }> {
    const list: Array<GritSubjectDef & { level: number }> = [];
    for (const lvl of GRIT_LEVELS) {
      for (const s of lvl.subjects) {
        if (this.resultOf(lvl.level, s.subject) === 'none') {
          list.push({ ...s, level: lvl.level });
        }
      }
    }
    return list;
  }

  completedSubjectsOverall(): Array<GritSubjectDef & { level: number; result: GritResult }> {
    const list: Array<GritSubjectDef & { level: number; result: GritResult }> = [];
    for (const lvl of GRIT_LEVELS) {
      for (const s of lvl.subjects) {
        const result = this.resultOf(lvl.level, s.subject);
        if (result !== 'none') {
          list.push({ ...s, level: lvl.level, result });
        }
      }
    }
    return list;
  }

  levelStats(level: number, subjects: GritSubjectDef[]) {
    let miles = 0;
    let cleared = 0;
    for (const s of subjects) {
      const result = this.resultOf(level, s.subject);
      miles += milesForResult(s, result);
      if (result !== 'none') cleared++;
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
    const existing = this.find(level, subject);
    if (existing?.inClimb) return;
    const allClimbers = this._rows().filter((r) => r.inClimb);
    const nextPos = allClimbers.length > 0 ? Math.max(...allClimbers.map((c) => c.position)) + 1 : 0;
    this.upsert(level, subject, {
      inClimb: true,
      position: nextPos,
      target: existing?.target ?? 'gold',
    });
  }

  removeFromClimb(level: number, subject: string): void {
    this.upsert(level, subject, { inClimb: false });
    this.reindexAllClimb();
  }

  reorderOverallClimb(draggedId: string, overId: string): void {
    if (!draggedId || draggedId === overId) return;
    const climb = this.overallClimb();
    const ids = climb.map((r) => r.id);
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

  moveOverallClimb(rowId: string, dir: -1 | 1): void {
    const list = this.overallClimb();
    const i = list.findIndex((r) => r.id === rowId);
    const over = list[i + dir];
    if (over) this.reorderOverallClimb(rowId, over.id);
  }

  reorderClimb(level: number, draggedId: string, overId: string): void {
    if (!draggedId || draggedId === overId) return;
    const levelClimb = this.climbFor(level);
    const fromIndex = levelClimb.findIndex((r) => r.id === draggedId);
    const toIndex = levelClimb.findIndex((r) => r.id === overId);
    if (fromIndex < 0 || toIndex < 0) return;

    const overall = this.overallClimb();
    const overallFrom = overall.findIndex((r) => r.id === draggedId);
    const overallTo = overall.findIndex((r) => r.id === overId);
    if (overallFrom < 0 || overallTo < 0) return;

    const ids = overall.map((r) => r.id);
    ids.splice(overallTo, 0, ids.splice(overallFrom, 1)[0]);
    this._rows.update((list) =>
      list.map((row) => {
        const idx = ids.indexOf(row.id);
        return idx >= 0 ? { ...row, position: idx } : row;
      }),
    );
    this.persist();
  }

  moveClimb(level: number, row: GritProgress, dir: -1 | 1): void {
    const list = this.climbFor(level);
    const i = list.findIndex((r) => r.id === row.id);
    const over = list[i + dir];
    if (over) this.reorderClimb(level, row.id, over.id);
  }

  queueAllRemaining(level?: number): void {
    if (level !== undefined) {
      const lvl = GRIT_LEVELS.find((l) => l.level === level);
      if (!lvl) return;
      const av = this.availableForClimb(level, lvl.subjects);
      for (const s of av) {
        this.addToClimb(level, s.subject);
      }
    } else {
      const av = this.availableForOverallClimb();
      for (const s of av) {
        this.addToClimb(s.level, s.subject);
      }
    }
  }

  clearCompletedFromClimb(level?: number): void {
    const climb = level !== undefined ? this.climbFor(level) : this.overallClimb();
    const completed = climb.filter((r) => r.result !== 'none');
    for (const r of completed) {
      const row = this.find(r.level, r.subject);
      if (row) {
        this.upsert(r.level, r.subject, { inClimb: false });
      }
    }
    this.reindexAllClimb();
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

  private reindexAllClimb(): void {
    const ordered = this.overallClimb();
    this._rows.update((list) =>
      list.map((row) => {
        const idx = ordered.findIndex((c) => c.id === row.id);
        return idx >= 0 ? { ...row, position: idx } : row;
      }),
    );
    this.persist();
  }

  private migrateLegacySubjects(rows: GritProgress[]): GritProgress[] {
    return (rows ?? []).map((r) => {
      if (r.level === 3) {
        if (r.subject === 'MCQs' || r.subject === 'MCQ') {
          return { ...r, subject: 'Gen AI Level 3' };
        }
        if (r.subject === 'Coding') {
          return { ...r, subject: 'Computational Thinking Level 3' };
        }
      }
      return r;
    });
  }

  private normalizePositions(rows: GritProgress[]): GritProgress[] {
    const inClimb = rows.filter((r) => r.inClimb);
    if (inClimb.length <= 1) return rows;
    const positions = new Set(inClimb.map((r) => r.position));
    if (positions.size === inClimb.length) return rows;
    const sorted = [...inClimb].sort((a, b) => a.position - b.position || a.level - b.level);
    const posMap = new Map<string, number>();
    sorted.forEach((r, idx) => posMap.set(r.id, idx));
    return rows.map((r) => (posMap.has(r.id) ? { ...r, position: posMap.get(r.id)! } : r));
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
