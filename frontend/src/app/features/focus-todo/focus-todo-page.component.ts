import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ThemeService } from '../../core/services/theme.service';
import {
  FOCUS_PRESET_CATEGORIES,
  FOCUS_TIMER_PRESETS,
  FocusTodoService,
} from '../../core/services/focus-todo.service';
import { ActivityService } from '../../core/services/activity.service';
import { ToastService } from '../../core/services/toast.service';
import {
  FocusFilterTab,
  FocusPriority,
  FocusSortOrder,
  FocusStatus,
  FocusTodoItem,
} from '../../core/models';
import { minutesToTime, parseTimeToMinutes, todayKey } from '../../core/utils/stats.utils';

@Component({
  selector: 'app-focus-todo-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './focus-todo-page.component.html',
  styleUrl: './focus-todo-page.component.css',
})
export class FocusTodoPageComponent implements OnDestroy {
  readonly theme = inject(ThemeService);
  readonly focus = inject(FocusTodoService);
  private readonly activityService = inject(ActivityService);
  private readonly toast = inject(ToastService);

  readonly today = todayKey();
  readonly categories = FOCUS_PRESET_CATEGORIES;
  readonly timerPresets = FOCUS_TIMER_PRESETS;

  // Filter and view state
  readonly activeTab = signal<FocusFilterTab>('active');
  readonly searchQuery = signal<string>('');
  readonly selectedPriority = signal<string>('all');
  readonly selectedCategory = signal<string>('all');
  readonly sortBy = signal<FocusSortOrder>(
    (localStorage.getItem('focus_todo_sort') as FocusSortOrder) || 'priority-desc'
  );
  readonly quickAddExpanded = signal<boolean>(false);
  readonly expandedCards = signal<Record<string, boolean>>({});
  readonly editingId = signal<string | null>(null);
  readonly draggingId = signal<string | null>(null);

  // Timer state
  readonly activeTimerTodoId = signal<string | null>(null);
  readonly timerRunning = signal<boolean>(false);
  readonly timerRemaining = signal<number>(0);
  readonly timerLength = signal<number>(25);
  private timerInterval: ReturnType<typeof setInterval> | null = null;
  private sessionElapsedSec = 0;

  // Quick Add Form
  newTitle = '';
  newCategory = 'General';
  newPriority: FocusPriority = 'medium';
  newEstimatedMinutes = 25;
  newDueDate = '';
  newDueTime = '';
  newNotes = '';
  newIsPinned = false;

  // Edit Form Draft
  editTitle = '';
  editCategory = 'General';
  editPriority: FocusPriority = 'medium';
  editEstimatedMinutes = 25;
  editDueDate = '';
  editDueTime = '';
  editNotes = '';
  editIsPinned = false;

  // Subtask input drafts by todoId
  subtaskDrafts: Record<string, string> = {};

  readonly activeTimerTodo = computed(() => {
    const id = this.activeTimerTodoId();
    if (!id) return null;
    return this.focus.todos().find((t) => t.id === id) || null;
  });

  readonly filteredTodos = computed(() => {
    let list = this.focus.todos();
    const tab = this.activeTab();
    const query = this.searchQuery().trim().toLowerCase();
    const priority = this.selectedPriority();
    const cat = this.selectedCategory();
    const today = this.today;

    // Filter by tab
    if (tab === 'active') {
      list = list.filter((t) => t.status !== 'completed');
    } else if (tab === 'pinned') {
      list = list.filter((t) => t.status !== 'completed' && t.isPinned);
    } else if (tab === 'due') {
      list = list.filter(
        (t) => t.status !== 'completed' && t.dueDate && (t.dueDate <= today)
      );
    } else if (tab === 'completed') {
      list = list.filter((t) => t.status === 'completed');
    }

    // Filter by priority
    if (priority !== 'all') {
      list = list.filter((t) => t.priority === priority);
    }

    // Filter by category
    if (cat !== 'all') {
      list = list.filter((t) => t.category.toLowerCase() === cat.toLowerCase());
    }

    // Filter by search query
    if (query) {
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(query) ||
          t.notes.toLowerCase().includes(query) ||
          t.category.toLowerCase().includes(query) ||
          t.subtasks.some((st) => st.title.toLowerCase().includes(query))
      );
    }

    // Sort order
    const sort = this.sortBy();
    const priorityWeight: Record<FocusPriority, number> = {
      urgent: 4,
      high: 3,
      medium: 2,
      low: 1,
    };

    return [...list].sort((a, b) => {
      // Pinned items stay at top of active lists
      if (a.status !== 'completed' && b.status !== 'completed') {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
      }

      if (sort === 'priority-desc') {
        const diff = priorityWeight[b.priority] - priorityWeight[a.priority];
        if (diff !== 0) return diff;
      } else if (sort === 'priority-asc') {
        const diff = priorityWeight[a.priority] - priorityWeight[b.priority];
        if (diff !== 0) return diff;
      } else if (sort === 'due-date') {
        if (a.dueDate && b.dueDate) {
          const diff = a.dueDate.localeCompare(b.dueDate);
          if (diff !== 0) return diff;
        } else if (a.dueDate && !b.dueDate) {
          return -1;
        } else if (!a.dueDate && b.dueDate) {
          return 1;
        }
      } else if (sort === 'title') {
        const diff = a.title.localeCompare(b.title);
        if (diff !== 0) return diff;
      }

      return a.position - b.position;
    });
  });

  readonly tabCounts = computed(() => {
    const all = this.focus.todos();
    const active = all.filter((t) => t.status !== 'completed');
    const pinned = active.filter((t) => t.isPinned);
    const due = active.filter((t) => t.dueDate && t.dueDate <= this.today);
    const completed = all.filter((t) => t.status === 'completed');

    return {
      all: all.length,
      active: active.length,
      pinned: pinned.length,
      due: due.length,
      completed: completed.length,
    };
  });

  ngOnDestroy(): void {
    this.clearTimer();
  }

  toggleTheme(): void {
    this.theme.toggleLightDark();
  }

  // --- Quick Add ---
  toggleQuickAdd(): void {
    this.quickAddExpanded.update((v) => !v);
  }

  submitQuickAdd(): void {
    if (!this.newTitle.trim()) return;

    this.focus.add({
      title: this.newTitle,
      priority: this.newPriority,
      category: this.newCategory,
      dueDate: this.newDueDate,
      dueTime: this.newDueTime,
      estimatedMinutes: this.newEstimatedMinutes,
      notes: this.newNotes,
      isPinned: this.newIsPinned,
    });

    // Reset fields
    this.newTitle = '';
    this.newNotes = '';
    this.newDueDate = '';
    this.newDueTime = '';
    this.newIsPinned = false;
    this.newPriority = 'medium';
    this.newCategory = 'General';
    this.newEstimatedMinutes = 25;
  }

  setQuickPreset(category: string, title?: string, priority: FocusPriority = 'medium'): void {
    this.newCategory = category;
    this.newPriority = priority;
    if (title) {
      this.newTitle = title;
    }
    this.quickAddExpanded.set(true);
  }

  // --- Accordion Panel & Subtasks ---
  isCardExpanded(id: string): boolean {
    return Boolean(this.expandedCards()[id]);
  }

  toggleCard(id: string): void {
    this.expandedCards.update((map) => ({ ...map, [id]: !map[id] }));
  }

  expandAll(): void {
    const next: Record<string, boolean> = {};
    for (const t of this.filteredTodos()) {
      next[t.id] = true;
    }
    this.expandedCards.set(next);
  }

  collapseAll(): void {
    this.expandedCards.set({});
  }

  readonly allExpanded = computed(() => {
    const list = this.filteredTodos();
    return list.length > 0 && list.every((t) => Boolean(this.expandedCards()[t.id]));
  });

  subtasksProgress(todo: FocusTodoItem): { total: number; done: number; percent: number } {
    const total = todo.subtasks?.length || 0;
    const done = todo.subtasks?.filter((s) => s.done).length || 0;
    const percent = total > 0 ? Math.round((done / total) * 100) : 0;
    return { total, done, percent };
  }

  handleAddSubtask(todoId: string): void {
    const draft = this.subtaskDrafts[todoId]?.trim();
    if (!draft) return;
    this.focus.addSubtask(todoId, draft);
    this.subtaskDrafts[todoId] = '';
    // Ensure card accordion is expanded
    this.expandedCards.update((map) => ({ ...map, [todoId]: true }));
  }

  // --- Due & Status Helpers ---
  isOverdue(todo: FocusTodoItem): boolean {
    if (!todo.dueDate || todo.status === 'completed') return false;
    return todo.dueDate < this.today;
  }

  isDueToday(todo: FocusTodoItem): boolean {
    if (!todo.dueDate || todo.status === 'completed') return false;
    return todo.dueDate === this.today;
  }

  dueLabel(todo: FocusTodoItem): string {
    if (!todo.dueDate) return '';
    if (todo.dueDate < this.today) return `Overdue (${todo.dueDate})`;
    if (todo.dueDate === this.today) return 'Due today' + (todo.dueTime ? ` at ${todo.dueTime}` : '');
    return `Due ${todo.dueDate}` + (todo.dueTime ? ` ${todo.dueTime}` : '');
  }

  // --- Editing ---
  startEdit(todo: FocusTodoItem): void {
    this.editingId.set(todo.id);
    this.editTitle = todo.title;
    this.editCategory = todo.category;
    this.editPriority = todo.priority;
    this.editEstimatedMinutes = todo.estimatedMinutes;
    this.editDueDate = todo.dueDate;
    this.editDueTime = todo.dueTime;
    this.editNotes = todo.notes;
    this.editIsPinned = todo.isPinned;
  }

  cancelEdit(): void {
    this.editingId.set(null);
  }

  saveEdit(id: string): void {
    if (!this.editTitle.trim()) return;
    this.focus.update(id, {
      title: this.editTitle,
      category: this.editCategory,
      priority: this.editPriority,
      estimatedMinutes: this.editEstimatedMinutes,
      dueDate: this.editDueDate,
      dueTime: this.editDueTime,
      notes: this.editNotes,
      isPinned: this.editIsPinned,
    });
    this.editingId.set(null);
    this.toast.success('Focus item updated');
  }

  // --- Focus Timer ---
  openTimer(todo: FocusTodoItem, lengthMinutes = 25): void {
    if (this.activeTimerTodoId() === todo.id && this.timerRunning()) return;
    this.clearTimer();
    this.activeTimerTodoId.set(todo.id);
    this.timerLength.set(lengthMinutes);
    this.timerRemaining.set(lengthMinutes * 60);
    this.sessionElapsedSec = 0;
    this.timerRunning.set(false);
  }

  startTimer(): void {
    if (!this.activeTimerTodoId()) return;
    if (this.timerRemaining() <= 0) {
      this.timerRemaining.set(this.timerLength() * 60);
    }
    this.timerRunning.set(true);
    this.clearTimer();
    this.timerInterval = setInterval(() => this.tickTimer(), 1000);
  }

  pauseTimer(): void {
    this.timerRunning.set(false);
    this.clearTimer();
  }

  private tickTimer(): void {
    const cur = this.timerRemaining() - 1;
    this.sessionElapsedSec++;
    if (cur <= 0) {
      this.finishTimerSession(true);
      return;
    }
    this.timerRemaining.set(cur);
  }

  stopTimer(logElapsed = true): void {
    this.finishTimerSession(false, logElapsed);
  }

  private finishTimerSession(completed: boolean, logTime = true): void {
    this.clearTimer();
    this.timerRunning.set(false);
    const todoId = this.activeTimerTodoId();
    const plannedSec = this.timerLength() * 60;
    const elapsedSec = completed ? plannedSec : Math.min(plannedSec, this.sessionElapsedSec);
    const minutes = Math.round(elapsedSec / 60);

    if (todoId && logTime && minutes >= 1) {
      this.focus.addLoggedMinutes(todoId, minutes);
      this.toast.success(`Logged ${minutes}m focus time!`);
    }

    if (completed) {
      this.toast.success('🎉 Focus session completed! Great job!');
    }

    this.timerRemaining.set(0);
    this.sessionElapsedSec = 0;
    this.activeTimerTodoId.set(null);
  }

  private clearTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  clockDisplay(): string {
    const total = this.timerRemaining();
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  // --- Log to Pulse Activity Journal ---
  logAsActivity(todo: FocusTodoItem): void {
    const duration = todo.loggedMinutes > 0 ? todo.loggedMinutes : todo.estimatedMinutes || 25;
    const now = new Date();
    const endMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = Math.max(0, endMinutes - duration);

    const startTime = minutesToTime(startMinutes);
    const endTime = minutesToTime(endMinutes);

    this.activityService.create({
      name: `Focus: ${todo.title}`,
      category: todo.category || 'General',
      date: this.today,
      startTime,
      endTime,
      type: 'productive',
      notes: todo.notes ? `Task: ${todo.title}\n${todo.notes}` : `Task: ${todo.title}`,
    });

    this.toast.success(`Logged "${todo.title}" (${duration}m) to Activity log!`);
  }

  setSortBy(order: FocusSortOrder): void {
    this.sortBy.set(order);
    try {
      localStorage.setItem('focus_todo_sort', order);
    } catch {
      // ignore
    }
  }

  setTodoPriority(todoId: string, priority: FocusPriority): void {
    this.focus.update(todoId, { priority });
    this.toast.info(`Priority updated to ${priority.toUpperCase()}`);
  }

  moveTodo(id: string, direction: -1 | 1): void {
    if (this.sortBy() !== 'default') {
      this.setSortBy('default');
      this.toast.info('Switched to Custom Order for manual arrangement');
    }
    this.focus.move(id, direction);
  }

  // --- Drag and Drop Reordering ---
  onDragStart(id: string, event: DragEvent): void {
    this.draggingId.set(id);
    event.dataTransfer?.setData('text/plain', id);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  onDrop(overId: string, event: DragEvent): void {
    event.preventDefault();
    const dragged = this.draggingId();
    if (dragged) {
      if (this.sortBy() !== 'default') {
        this.setSortBy('default');
        this.toast.info('Switched to Custom Order for manual arrangement');
      }
      this.focus.reorder(dragged, overId);
    }
    this.draggingId.set(null);
  }

  allowDrop(event: DragEvent): void {
    event.preventDefault();
  }
}
