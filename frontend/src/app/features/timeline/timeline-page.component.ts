import { Component, computed, inject } from '@angular/core';
import { DateNavComponent } from '../../shared/components/date-nav/date-nav.component';
import { TimelineViewComponent } from '../../shared/components/timeline-view/timeline-view.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { ActivityService } from '../../core/services/activity.service';
import { DateNavService } from '../../core/services/date-nav.service';
import { ActivityModalService } from '../../shared/components/activity-modal/activity-modal.service';
import { Activity } from '../../core/models';
import { eachDateInRange } from '../../core/utils/stats.utils';

@Component({
  selector: 'app-timeline-page',
  standalone: true,
  imports: [DateNavComponent, TimelineViewComponent, EmptyStateComponent],
  template: `
    <section class="page">
      <header class="page-header page-header--row">
        <div>
          <p class="eyebrow">Timeline</p>
          <h1>Chronological log</h1>
        </div>
        <div class="page-header__actions">
          <app-date-nav />
          <button type="button" class="btn btn--primary" (click)="add()">+ Add</button>
        </div>
      </header>

      @if (days().length === 0) {
        <app-empty-state
          title="Timeline is empty"
          message="Activities you log will appear here in order."
          actionLabel="+ Add Activity"
          (action)="add()"
        />
      } @else {
        @for (day of days(); track day.date) {
          <section class="panel timeline-day">
            <h3>{{ day.date }}</h3>
            <app-timeline-view [activities]="day.items" (select)="edit($event)" />
          </section>
        }
      }
    </section>
  `,
  styles: `
    :host { display: block; }
    .page-header--row { display:flex; flex-wrap:wrap; justify-content:space-between; gap:1rem; margin-bottom:1.25rem; }
    .page-header h1 { margin:0.15rem 0 0; font-family:var(--font-display); letter-spacing:-0.03em; }
    .page-header__actions { display:flex; flex-direction:column; align-items:flex-end; gap:0.75rem; }
    .timeline-day { margin-bottom: 1rem; }
    .timeline-day h3 { margin: 0 0 0.75rem; font-size: 0.95rem; color: var(--text-muted); }
  `,
})
export class TimelinePageComponent {
  private readonly activities = inject(ActivityService);
  private readonly dates = inject(DateNavService);
  private readonly modal = inject(ActivityModalService);

  readonly days = computed(() => {
    const start = this.dates.rangeStart();
    const end = this.dates.rangeEnd();
    return eachDateInRange(start, end)
      .map((date) => ({ date, items: this.activities.getByDate(date) }))
      .filter((d) => d.items.length > 0)
      .reverse();
  });

  add(): void {
    const date = this.dates.selectedDate();
    const slot = this.activities.nextSlot(date);
    this.modal.openCreate({
      date,
      startTime: slot.startTime,
      endTime: slot.endTime,
      continueFrom: slot.afterName,
    });
  }

  edit(a: Activity): void {
    this.modal.openEdit(a);
  }
}
