import { Injectable, computed, inject, signal } from '@angular/core';
import { STORAGE_KEYS } from '../constants/categories';
import { FocusFilterTab, FocusPriority, FocusStatus, FocusSubtask, FocusTodoItem } from '../models';
import { LocalStoreService } from './local-store.service';
import { TrackerApiService } from './tracker-api.service';
import { ToastService } from './toast.service';
import { apiErrorMessage } from '../utils/api-error';
import { createId, todayKey } from '../utils/stats.utils';

export const FOCUS_PRESET_CATEGORIES = [
  'General',
  'Coding',
  'DSA',
  'Development',
  'Academics',
  'Projects',
  'Assignments',
  'Interview Prep',
  'Urgent',
  'Personal',
] as const;

export const FOCUS_TIMER_PRESETS = [15, 25, 45, 60] as const;

function reindex(todos: FocusTodoItem[]): FocusTodoItem[] {
  return todos.map((item, index) => ({ ...item, position: index }));
}

function cleanTodos(raw: unknown): FocusTodoItem[] {
  if (!Array.isArray(raw)) return [];
  const validStatus = ['pending', 'in_progress', 'completed'];
  const validPriority = ['urgent', 'high', 'medium', 'low'];

  return raw.map((item, index) => {
    const rawSubtasks = Array.isArray(item?.subtasks) ? item.subtasks : [];
    const subtasks: FocusSubtask[] = rawSubtasks.map((st: any) => ({
      id: String(st?.id || createId()),
      title: String(st?.title || '').trim().slice(0, 200) || 'Subtask',
      done: Boolean(st?.done),
    }));

    const status: FocusStatus = validStatus.includes(item?.status) ? item.status : 'pending';
    const priority: FocusPriority = validPriority.includes(item?.priority) ? item.priority : 'medium';
    const isPinned = Boolean(item?.isPinned);

    return {
      id: String(item?.id || createId()),
      title: String(item?.title || '').trim().slice(0, 250) || 'Focus Item',
      notes: String(item?.notes || '').trim().slice(0, 2000),
      status,
      priority,
      isPinned,
      category: String(item?.category || 'General').trim().slice(0, 80) || 'General',
      dueDate: String(item?.dueDate || '').trim().slice(0, 10),
      dueTime: String(item?.dueTime || '').trim().slice(0, 5),
      estimatedMinutes: Math.min(1440, Math.max(0, Math.round(Number(item?.estimatedMinutes) || 0))) || 25,
      loggedMinutes: Math.max(0, Math.round(Number(item?.loggedMinutes) || 0)),
      subtasks,
      completedAt: item?.completedAt ? String(item.completedAt).slice(0, 40) : null,
      createdAt: item?.createdAt ? String(item.createdAt).slice(0, 40) : new Date().toISOString(),
      position: Number.isFinite(Number(item?.position)) ? Number(item.position) : index,
    };
  });
}

@Injectable({ providedIn: 'root' })
export class FocusTodoService {
  private readonly store = inject(LocalStoreService);
  private readonly api = inject(TrackerApiService);
  private readonly toast = inject(ToastService);

  private readonly _todos = signal<FocusTodoItem[]>(
    cleanTodos(this.store.get<FocusTodoItem[]>(STORAGE_KEYS.focusTodos, []))
  );

  private persistTimer: ReturnType<typeof setTimeout> | null = null;

  readonly todos = computed(() =>
    [...this._todos()].sort((a, b) => {
      // Pinned items first among active tasks
      if (a.status !== 'completed' && b.status !== 'completed') {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
      }
      return a.position - b.position;
    })
  );

  readonly activeTodos = computed(() =>
    this.todos().filter((t) => t.status !== 'completed')
  );

  readonly completedTodos = computed(() =>
    this.todos().filter((t) => t.status === 'completed')
  );

  readonly pinnedTodos = computed(() =>
    this.activeTodos().filter((t) => t.isPinned)
  );

  readonly unpinnedActiveTodos = computed(() =>
    this.activeTodos().filter((t) => !t.isPinned)
  );

  readonly stats = computed(() => {
    const all = this._todos();
    const completed = all.filter((t) => t.status === 'completed');
    const active = all.filter((t) => t.status !== 'completed');
    const pinned = active.filter((t) => t.isPinned);
    const today = todayKey();
    const completedToday = completed.filter((t) => t.completedAt?.startsWith(today)).length;
    const totalEstMinutes = active.reduce((acc, t) => acc + (t.estimatedMinutes || 0), 0);
    const totalLoggedMinutes = all.reduce((acc, t) => acc + (t.loggedMinutes || 0), 0);
    const percent = all.length ? Math.round((completed.length / all.length) * 100) : 0;

    return {
      total: all.length,
      active: active.length,
      pinned: pinned.length,
      completed: completed.length,
      completedToday,
      percent,
      totalEstMinutes,
      totalLoggedMinutes,
    };
  });

  hydrate(items: FocusTodoItem[] | null | undefined): void {
    const cleaned = cleanTodos(items || []);
    this._todos.set(cleaned);
    this.store.set(STORAGE_KEYS.focusTodos, cleaned);
  }

  resetLocal(): void {
    this._todos.set([]);
    this.store.remove(STORAGE_KEYS.focusTodos);
  }

  add(payload: {
    title: string;
    priority?: FocusPriority;
    category?: string;
    dueDate?: string;
    dueTime?: string;
    estimatedMinutes?: number;
    notes?: string;
    isPinned?: boolean;
  }): FocusTodoItem | null {
    const trimmed = payload.title.trim();
    if (!trimmed) return null;

    const newItem: FocusTodoItem = {
      id: createId(),
      title: trimmed.slice(0, 250),
      notes: (payload.notes || '').trim().slice(0, 2000),
      status: 'pending',
      priority: payload.priority || 'medium',
      isPinned: Boolean(payload.isPinned),
      category: (payload.category || 'General').trim().slice(0, 80) || 'General',
      dueDate: (payload.dueDate || '').trim().slice(0, 10),
      dueTime: (payload.dueTime || '').trim().slice(0, 5),
      estimatedMinutes: Math.min(1440, Math.max(0, Math.round(Number(payload.estimatedMinutes) || 25))),
      loggedMinutes: 0,
      subtasks: [],
      completedAt: null,
      createdAt: new Date().toISOString(),
      position: this._todos().length,
    };

    this.patch((todos) => {
      // If pinned, insert at front of active items; else append
      return reindex([newItem, ...todos]);
    });

    this.toast.success(`Added "${newItem.title}" to Focus List`);
    return newItem;
  }

  update(id: string, updates: Partial<FocusTodoItem>): void {
    this.patch((todos) =>
      todos.map((item) => {
        if (item.id !== id) return item;
        return {
          ...item,
          ...updates,
          title: updates.title !== undefined ? updates.title.trim().slice(0, 250) : item.title,
          notes: updates.notes !== undefined ? updates.notes.trim().slice(0, 2000) : item.notes,
        };
      })
    );
  }

  toggleComplete(id: string): void {
    let nowDone = false;
    this.patch((todos) =>
      todos.map((item) => {
        if (item.id !== id) return item;
        nowDone = item.status !== 'completed';
        return {
          ...item,
          status: nowDone ? 'completed' : 'pending',
          completedAt: nowDone ? new Date().toISOString() : null,
        };
      })
    );
    if (nowDone) {
      this.toast.success('Focus item marked as completed!');
    }
  }

  togglePin(id: string): void {
    this.patch((todos) =>
      todos.map((item) => (item.id === id ? { ...item, isPinned: !item.isPinned } : item))
    );
  }

  setStatus(id: string, status: FocusStatus): void {
    const isCompleted = status === 'completed';
    this.patch((todos) =>
      todos.map((item) =>
        item.id === id
          ? {
              ...item,
              status,
              completedAt: isCompleted ? (item.completedAt || new Date().toISOString()) : null,
            }
          : item
      )
    );
  }

  setPriority(id: string, priority: FocusPriority): void {
    this.update(id, { priority });
  }

  addLoggedMinutes(id: string, minutes: number): void {
    const added = Math.max(0, Math.round(minutes));
    if (!added) return;
    this.patch((todos) =>
      todos.map((item) =>
        item.id === id
          ? { ...item, loggedMinutes: (item.loggedMinutes || 0) + added }
          : item
      )
    );
  }

  addSubtask(todoId: string, title: string): void {
    const trimmed = title.trim();
    if (!trimmed) return;
    const subtask: FocusSubtask = {
      id: createId(),
      title: trimmed.slice(0, 200),
      done: false,
    };
    this.patch((todos) =>
      todos.map((item) =>
        item.id === todoId
          ? { ...item, subtasks: [...item.subtasks, subtask] }
          : item
      )
    );
  }

  toggleSubtask(todoId: string, subtaskId: string): void {
    this.patch((todos) =>
      todos.map((item) => {
        if (item.id !== todoId) return item;
        const nextSubtasks = item.subtasks.map((st) =>
          st.id === subtaskId ? { ...st, done: !st.done } : st
        );
        return { ...item, subtasks: nextSubtasks };
      })
    );
  }

  deleteSubtask(todoId: string, subtaskId: string): void {
    this.patch((todos) =>
      todos.map((item) => {
        if (item.id !== todoId) return item;
        return {
          ...item,
          subtasks: item.subtasks.filter((st) => st.id !== subtaskId),
        };
      })
    );
  }

  move(id: string, direction: -1 | 1): void {
    this.patch((todos) => {
      const active = todos.filter((t) => t.status !== 'completed');
      const completed = todos.filter((t) => t.status === 'completed');
      const idx = active.findIndex((t) => t.id === id);
      const nextIdx = idx + direction;
      if (idx < 0 || nextIdx < 0 || nextIdx >= active.length) return todos;
      const copy = [...active];
      const [item] = copy.splice(idx, 1);
      copy.splice(nextIdx, 0, item);
      return reindex([...copy, ...completed]);
    });
  }

  reorder(draggedId: string, overId: string): void {
    if (draggedId === overId) return;
    this.patch((todos) => {
      const active = todos.filter((t) => t.status !== 'completed');
      const completed = todos.filter((t) => t.status === 'completed');
      const from = active.findIndex((t) => t.id === draggedId);
      const to = active.findIndex((t) => t.id === overId);
      if (from < 0 || to < 0) return todos;
      const copy = [...active];
      const [item] = copy.splice(from, 1);
      copy.splice(to, 0, item);
      return reindex([...copy, ...completed]);
    });
  }

  delete(id: string): void {
    this.patch((todos) => reindex(todos.filter((t) => t.id !== id)));
    this.toast.info('Item removed');
  }

  clearCompleted(): void {
    const prevCount = this.completedTodos().length;
    if (!prevCount) return;
    this.patch((todos) => reindex(todos.filter((t) => t.status !== 'completed')));
    this.toast.success(`Cleared ${prevCount} completed focus ${prevCount === 1 ? 'item' : 'items'}`);
  }

  private patch(mapper: (todos: FocusTodoItem[]) => FocusTodoItem[]): void {
    this._todos.update((todos) => cleanTodos(mapper(todos)));
    this.persist();
  }

  private persist(): void {
    this.store.set(STORAGE_KEYS.focusTodos, this._todos());
    if (!this.hasSession()) return;
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      this.api.saveFocusTodos(this._todos()).subscribe({
        error: (err) => this.toast.error(apiErrorMessage(err, 'Could not save focus to-dos to account')),
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
