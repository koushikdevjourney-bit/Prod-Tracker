import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivityService } from '../../core/services/activity.service';
import { ToastService } from '../../core/services/toast.service';
import { ActivityModalService } from '../../shared/components/activity-modal/activity-modal.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { DurationPipe } from '../../shared/pipes/format.pipes';
import { CATEGORIES } from '../../core/constants/categories';
import { Activity, ActivityType } from '../../core/models';

type SortKey = 'date' | 'duration' | 'name' | 'category';

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
  readonly search = signal('');
  readonly categoryFilter = signal('');
  readonly typeFilter = signal<ActivityType | ''>('');
  readonly sortKey = signal<SortKey>('date');
  readonly sortDir = signal<'asc' | 'desc'>('desc');
  readonly page = signal(1);
  readonly pageSize = 10;

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
    if (this.categoryFilter()) list = list.filter((a) => a.category === this.categoryFilter());
    if (this.typeFilter()) list = list.filter((a) => a.type === this.typeFilter());

    const key = this.sortKey();
    const dir = this.sortDir() === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      let cmp = 0;
      if (key === 'duration') cmp = a.durationMinutes - b.durationMinutes;
      else if (key === 'name') cmp = a.name.localeCompare(b.name);
      else if (key === 'category') cmp = a.category.localeCompare(b.category);
      else cmp = `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`);
      return cmp * dir;
    });
    return list;
  });

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.filtered().length / this.pageSize)));

  readonly pageItems = computed(() => {
    const p = Math.min(this.page(), this.totalPages());
    const start = (p - 1) * this.pageSize;
    return this.filtered().slice(start, start + this.pageSize);
  });

  add(): void {
    this.modal.openCreate();
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
