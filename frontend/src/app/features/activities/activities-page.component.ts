import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivityService } from '../../core/services/activity.service';
import { ToastService } from '../../core/services/toast.service';
import { ActivityModalService } from '../../shared/components/activity-modal/activity-modal.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { DurationPipe } from '../../shared/pipes/format.pipes';
import { CATEGORIES } from '../../core/constants/categories';
import { Activity, ActivityType } from '../../core/models';
import { addDays, parseTimeToMinutes, todayKey } from '../../core/utils/stats.utils';

type SortKey = 'date' | 'duration' | 'name' | 'category';
type ViewMode = 'grouped' | 'table';

export interface DayGroup {
  date: string;
  formattedDate: string;
  shortDate: string;
  relativeTag?: 'Today' | 'Yesterday';
  activities: Activity[];
  totalMinutes: number;
  productiveMinutes: number;
  productivePercent: number;
  itemCount: number;
}

export interface DatePill {
  date: string;
  label: string;
  count: number;
  isToday: boolean;
  isYesterday: boolean;
}

@Component({
  selector: 'app-activities-page',
  standalone: true,
  imports: [FormsModule, EmptyStateComponent, DurationPipe],
  templateUrl: './activities-page.component.html',
  styleUrl: './activities-page.component.css',
})
export class ActivitiesPageComponent {
  private readonly activities = inject(ActivityService);
  private readonly toast = inject(ToastService);
  private readonly modal = inject(ActivityModalService);

  readonly categories = CATEGORIES;
  readonly todayStr = todayKey();
  readonly yesterdayStr = addDays(this.todayStr, -1);

  // Filter signals
  readonly search = signal('');
  readonly categoryFilter = signal('');
  readonly typeFilter = signal<ActivityType | ''>('');
  readonly dateFilter = signal<string>(''); // YYYY-MM-DD or empty for all

  // View state signals
  readonly viewMode = signal<ViewMode>('grouped');
  readonly sortKey = signal<SortKey>('date');
  readonly sortDir = signal<'asc' | 'desc'>('desc');
  readonly page = signal(1);
  readonly pageSize = 12;
  readonly collapsedDays = signal<Set<string>>(new Set());

  /** All raw activities for count pill */
  readonly allActivities = computed(() => this.activities.activities());

  /** Filtered list based on search, category, type, and specific date filter */
  readonly filtered = computed(() => {
    let list = [...this.activities.sorted()];
    const q = this.search().trim().toLowerCase();
    if (q) {
      list = list.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.category.toLowerCase().includes(q) ||
          (a.notes ?? '').toLowerCase().includes(q),
      );
    }
    if (this.categoryFilter()) {
      list = list.filter((a) => a.category === this.categoryFilter());
    }
    if (this.typeFilter()) {
      list = list.filter((a) => a.type === this.typeFilter());
    }
    // Strict date filter: only the particular date activities are visible
    if (this.dateFilter()) {
      list = list.filter((a) => a.date === this.dateFilter());
    }

    const key = this.sortKey();
    const dir = this.sortDir() === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      let cmp = 0;
      if (key === 'duration') cmp = a.durationMinutes - b.durationMinutes;
      else if (key === 'name') cmp = a.name.localeCompare(b.name);
      else if (key === 'category') cmp = a.category.localeCompare(b.category);
      else {
        // Date sort
        if (a.date !== b.date) {
          cmp = a.date.localeCompare(b.date);
        } else {
          cmp = parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime);
        }
      }
      return cmp * dir;
    });
    return list;
  });

  /** Overall summary for current filtered view */
  readonly summary = computed(() => {
    const list = this.filtered();
    const totalMinutes = list.reduce((sum, a) => sum + (a.durationMinutes || 0), 0);
    const productiveMinutes = list
      .filter((a) => a.type === 'productive')
      .reduce((sum, a) => sum + (a.durationMinutes || 0), 0);
    const productivePercent = totalMinutes > 0 ? Math.round((productiveMinutes / totalMinutes) * 100) : 0;
    return {
      count: list.length,
      totalMinutes,
      productiveMinutes,
      productivePercent,
    };
  });

  /** Date pills extracted from existing activities for instant 1-click filtering */
  readonly availableDatePills = computed<DatePill[]>(() => {
    const counts = new Map<string, number>();
    for (const a of this.activities.sorted()) {
      if (a.date) {
        counts.set(a.date, (counts.get(a.date) || 0) + 1);
      }
    }
    const sortedDates = Array.from(counts.keys()).sort((a, b) => b.localeCompare(a));
    return sortedDates.map((date) => ({
      date,
      count: counts.get(date) || 0,
      label: this.formatDateShort(date),
      isToday: date === this.todayStr,
      isYesterday: date === this.yesterdayStr,
    }));
  });

  /** Activities grouped date-wise */
  readonly dayGroups = computed<DayGroup[]>(() => {
    const list = this.filtered();
    const groupsMap = new Map<string, Activity[]>();

    for (const a of list) {
      const d = a.date || 'Unspecified';
      if (!groupsMap.has(d)) {
        groupsMap.set(d, []);
      }
      groupsMap.get(d)!.push(a);
    }

    const result: DayGroup[] = [];
    for (const [date, items] of groupsMap.entries()) {
      // Ensure chronological ordering within the day
      items.sort((a, b) => parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime));

      const totalMinutes = items.reduce((sum, a) => sum + (a.durationMinutes || 0), 0);
      const productiveMinutes = items
        .filter((a) => a.type === 'productive')
        .reduce((sum, a) => sum + (a.durationMinutes || 0), 0);
      const productivePercent = totalMinutes > 0 ? Math.round((productiveMinutes / totalMinutes) * 100) : 0;

      let relativeTag: 'Today' | 'Yesterday' | undefined;
      if (date === this.todayStr) relativeTag = 'Today';
      else if (date === this.yesterdayStr) relativeTag = 'Yesterday';

      result.push({
        date,
        formattedDate: this.formatDateTitle(date),
        shortDate: this.formatDateShort(date),
        relativeTag,
        activities: items,
        totalMinutes,
        productiveMinutes,
        productivePercent,
        itemCount: items.length,
      });
    }

    // Sort day groups according to sortKey and sortDir
    if (this.sortKey() === 'date') {
      const dir = this.sortDir() === 'asc' ? 1 : -1;
      result.sort((a, b) => a.date.localeCompare(b.date) * dir);
    }

    return result;
  });

  // Flat table pagination
  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.filtered().length / this.pageSize)));
  readonly pageItems = computed(() => {
    const p = Math.min(this.page(), this.totalPages());
    const start = (p - 1) * this.pageSize;
    return this.filtered().slice(start, start + this.pageSize);
  });

  // Date formatting helpers
  formatDateTitle(dateKey: string): string {
    if (!dateKey || dateKey === 'Unspecified') return 'Unspecified Date';
    try {
      const [y, m, d] = dateKey.split('-').map(Number);
      if (!y || !m || !d) return dateKey;
      const date = new Date(y, m - 1, d);
      if (isNaN(date.getTime())) return dateKey;
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateKey;
    }
  }

  formatDateShort(dateKey: string): string {
    if (!dateKey || dateKey === 'Unspecified') return 'Unspecified';
    try {
      const [y, m, d] = dateKey.split('-').map(Number);
      if (!y || !m || !d) return dateKey;
      const date = new Date(y, m - 1, d);
      if (isNaN(date.getTime())) return dateKey;
      return date.toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'short',
      });
    } catch {
      return dateKey;
    }
  }

  selectedDateDisplay(): string {
    const d = this.dateFilter();
    if (!d) return '';
    if (d === this.todayStr) return `Today (${this.formatDateTitle(d)})`;
    if (d === this.yesterdayStr) return `Yesterday (${this.formatDateTitle(d)})`;
    return this.formatDateTitle(d);
  }

  // Filter actions
  setDateFilter(date: string): void {
    this.dateFilter.set(date);
    this.page.set(1);
  }

  clearDateFilter(): void {
    this.dateFilter.set('');
    this.page.set(1);
  }

  selectToday(): void {
    this.setDateFilter(this.todayStr);
  }

  selectYesterday(): void {
    this.setDateFilter(this.yesterdayStr);
  }

  clearAllFilters(): void {
    this.search.set('');
    this.categoryFilter.set('');
    this.typeFilter.set('');
    this.dateFilter.set('');
    this.page.set(1);
  }

  // View mode and collapse toggles
  setViewMode(mode: ViewMode): void {
    this.viewMode.set(mode);
  }

  isDayCollapsed(date: string): boolean {
    return this.collapsedDays().has(date);
  }

  toggleDayCollapse(date: string): void {
    this.collapsedDays.update((set) => {
      const next = new Set(set);
      if (next.has(date)) {
        next.delete(date);
      } else {
        next.add(date);
      }
      return next;
    });
  }

  expandAllDays(): void {
    this.collapsedDays.set(new Set());
  }

  collapseAllDays(): void {
    const all = new Set(this.dayGroups().map((g) => g.date));
    this.collapsedDays.set(all);
  }

  // CRUD actions
  add(forDate?: string): void {
    const targetDate = forDate || this.dateFilter() || this.todayStr;
    const slot = this.activities.nextSlot(targetDate);
    this.modal.openCreate({
      date: targetDate,
      startTime: slot.startTime,
      endTime: slot.endTime,
      continueFrom: slot.afterName,
    });
  }

  edit(a: Activity): void {
    this.modal.openEdit(a);
  }

  remove(a: Activity): void {
    if (!confirm(`Delete “${a.name}”?`)) return;
    this.activities.delete(a._id);
    this.toast.success('Activity deleted');
  }

  duplicate(a: Activity): void {
    this.activities.duplicate(a._id);
    this.toast.success('Activity duplicated');
  }

  setSort(key: SortKey): void {
    if (this.sortKey() === key) {
      this.sortDir.update((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortKey.set(key);
      this.sortDir.set(key === 'name' || key === 'category' ? 'asc' : 'desc');
    }
  }

  prevPage(): void {
    this.page.update((p) => Math.max(1, p - 1));
  }

  nextPage(): void {
    this.page.update((p) => Math.min(this.totalPages(), p + 1));
  }
}
