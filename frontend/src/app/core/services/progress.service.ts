import { Injectable, computed, inject, signal } from '@angular/core';
import { STORAGE_KEYS } from '../constants/categories';
import { EMPTY_PROGRESS, ProgressItem, ProgressState, overallPercent } from '../data/progress-catalog';
import { LocalStoreService } from './local-store.service';
import { TrackerApiService } from './tracker-api.service';
import { ToastService } from './toast.service';
import { apiErrorMessage } from '../utils/api-error';
import { createId, todayKey } from '../utils/stats.utils';

function cloneState(state: ProgressState | null | undefined): ProgressState {
  const today = todayKey();
  const sameDay = state?.focusDate === today;
  return {
    intention: String(state?.intention || ''),
    focusMinutesToday: sameDay ? Math.max(0, Number(state?.focusMinutesToday) || 0) : 0,
    focusDate: today,
    items: (state?.items || []).map((item) => ({
      id: item.id,
      title: item.title,
      note: item.note || '',
      percent: Math.min(100, Math.max(0, Number(item.percent) || 0)),
      done: Boolean(item.done),
      position: Number(item.position) || 0,
      source: item.source || 'Custom',
      due: item.due || '',
      minutes: Math.max(0, Number(item.minutes) || 0),
    })),
  };
}

function reindex(items: ProgressItem[]): ProgressItem[] {
  return items.map((item, index) => ({ ...item, position: index }));
}

@Injectable({ providedIn: 'root' })
export class ProgressService {
  private readonly store = inject(LocalStoreService);
  private readonly api = inject(TrackerApiService);
  private readonly toast = inject(ToastService);
  private readonly _state = signal<ProgressState>(
    cloneState(this.store.get<ProgressState>(STORAGE_KEYS.progress, EMPTY_PROGRESS)),
  );
  private persistTimer: ReturnType<typeof setTimeout> | null = null;

  readonly state = this._state.asReadonly();
  readonly items = computed(() =>
    [...this._state().items].sort((a, b) => a.position - b.position),
  );
  readonly open = computed(() => this.items().filter((item) => !item.done));
  readonly now = computed(() => this.open()[0] ?? null);
  readonly queue = computed(() => this.open().slice(1));
  readonly cleared = computed(() => this.items().filter((item) => item.done));
  readonly totals = computed(() => {
    const items = this.items();
    const done = items.filter((item) => item.done).length;
    return {
      total: items.length,
      open: items.length - done,
      done,
      percent: overallPercent(items),
    };
  });

  hydrate(state: ProgressState | null | undefined): void {
    const next = cloneState(state);
    this._state.set(next);
    this.store.set(STORAGE_KEYS.progress, next);
  }

  resetLocal(): void {
    this._state.set(cloneState(EMPTY_PROGRESS));
    this.store.remove(STORAGE_KEYS.progress);
  }

  setIntention(intention: string): void {
    this.patch((state) => ({ ...state, intention: intention.slice(0, 200) }));
  }

  add(title: string, source = 'Custom', asNow = false): void {
    const trimmed = title.trim();
    if (!trimmed) return;
    const exists = this.items().some(
      (item) => !item.done && item.title.toLowerCase() === trimmed.toLowerCase(),
    );
    if (exists) {
      this.toast.info('That focus is already in your queue');
      return;
    }
    const item: ProgressItem = {
      id: createId(),
      title: trimmed.slice(0, 160),
      note: '',
      percent: 0,
      done: false,
      position: this.items().length,
      source: source.slice(0, 80) || 'Custom',
      due: '',
      minutes: 0,
    };
    this.patch((state) => {
      const open = state.items.filter((row) => !row.done);
      const cleared = state.items.filter((row) => row.done);
      const nextOpen = asNow ? [item, ...open] : [...open, item];
      return { ...state, items: reindex([...nextOpen, ...cleared]) };
    });
  }

  rename(id: string, title: string): void {
    const trimmed = title.trim();
    if (!trimmed) return;
    this.mapItem(id, (item) => ({ ...item, title: trimmed.slice(0, 160) }));
  }

  setNote(id: string, note: string): void {
    this.mapItem(id, (item) => ({ ...item, note: note.slice(0, 400) }));
  }

  setDue(id: string, due: string): void {
    this.mapItem(id, (item) => ({ ...item, due: due.slice(0, 10) }));
  }

  addMinutes(id: string, minutes: number): void {
    const added = Math.max(0, Math.round(minutes));
    if (!added) return;
    this.patch((state) => ({
      ...state,
      focusMinutesToday: (state.focusMinutesToday || 0) + added,
      focusDate: todayKey(),
      items: state.items.map((item) =>
        item.id === id ? { ...item, minutes: (item.minutes || 0) + added } : item,
      ),
    }));
  }

  setPercent(id: string, percent: number): void {
    const value = Math.min(100, Math.max(0, Math.round(percent)));
    this.mapItem(id, (item) => ({
      ...item,
      percent: value,
      done: value >= 100 ? true : item.done && value < 100 ? false : item.done,
    }));
  }

  bump(id: string, delta: number): void {
    const item = this.items().find((row) => row.id === id);
    if (!item) return;
    this.setPercent(id, item.percent + delta);
  }

  toggleDone(id: string): void {
    this.patch((state) => {
      const items = state.items.map((item) =>
        item.id === id
          ? { ...item, done: !item.done, percent: !item.done ? Math.max(item.percent, 100) : Math.min(item.percent, 90) }
          : item,
      );
      const open = items.filter((item) => !item.done);
      const cleared = items.filter((item) => item.done);
      return { ...state, items: reindex([...open, ...cleared]) };
    });
  }

  makeNow(id: string): void {
    this.patch((state) => {
      const target = state.items.find((item) => item.id === id);
      if (!target || target.done) return state;
      const rest = state.items.filter((item) => item.id !== id);
      const open = rest.filter((item) => !item.done);
      const cleared = rest.filter((item) => item.done);
      return { ...state, items: reindex([{ ...target, done: false }, ...open, ...cleared]) };
    });
  }

  skip(id: string): void {
    this.patch((state) => {
      const target = state.items.find((item) => item.id === id);
      if (!target || target.done) return state;
      const rest = state.items.filter((item) => item.id !== id);
      const open = rest.filter((item) => !item.done);
      const cleared = rest.filter((item) => item.done);
      return { ...state, items: reindex([...open, { ...target }, ...cleared]) };
    });
  }

  move(id: string, direction: -1 | 1): void {
    this.patch((state) => {
      const open = state.items.filter((item) => !item.done).sort((a, b) => a.position - b.position);
      const cleared = state.items.filter((item) => item.done);
      const index = open.findIndex((item) => item.id === id);
      const next = index + direction;
      if (index < 0 || next < 0 || next >= open.length) return state;
      const copy = [...open];
      const [row] = copy.splice(index, 1);
      copy.splice(next, 0, row);
      return { ...state, items: reindex([...copy, ...cleared]) };
    });
  }

  reorderOpen(draggedId: string, overId: string): void {
    if (draggedId === overId) return;
    this.patch((state) => {
      const open = state.items.filter((item) => !item.done).sort((a, b) => a.position - b.position);
      const cleared = state.items.filter((item) => item.done);
      const from = open.findIndex((item) => item.id === draggedId);
      const to = open.findIndex((item) => item.id === overId);
      if (from < 0 || to < 0) return state;
      const copy = [...open];
      const [row] = copy.splice(from, 1);
      copy.splice(to, 0, row);
      return { ...state, items: reindex([...copy, ...cleared]) };
    });
  }

  remove(id: string): void {
    this.patch((state) => ({
      ...state,
      items: reindex(state.items.filter((item) => item.id !== id)),
    }));
  }

  private mapItem(id: string, mapper: (item: ProgressItem) => ProgressItem): void {
    this.patch((state) => ({
      ...state,
      items: state.items.map((item) => (item.id === id ? mapper(item) : item)),
    }));
  }

  private patch(mapper: (state: ProgressState) => ProgressState): void {
    this._state.update((state) => cloneState(mapper(state)));
    this.persist();
  }

  private persist(): void {
    this.store.set(STORAGE_KEYS.progress, this._state());
    if (!this.hasSession()) return;
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      this.api.saveProgress(this._state()).subscribe({
        error: (err) => this.toast.error(apiErrorMessage(err, 'Could not save current progress')),
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
