import { Component, input, output } from '@angular/core';
import { Activity } from '../../../core/models';
import { DurationPipe } from '../../pipes/format.pipes';
import { getCategoryColor, parseTimeToMinutes } from '../../../core/utils/stats.utils';

@Component({
  selector: 'app-timeline-view',
  standalone: true,
  imports: [DurationPipe],
  template: `
    <div class="timeline">
      @if (activities().length === 0) {
        <p class="muted">No activities for this day.</p>
      } @else {
        <ul class="timeline__list">
          @for (a of sorted(); track a._id) {
            <li class="timeline__item" (click)="select.emit(a)" [style.--dot]="color(a.category)">
              <div class="timeline__time">
                <span>{{ a.startTime }}</span>
                <span class="muted">{{ a.endTime }}</span>
              </div>
              <div class="timeline__card">
                <div class="timeline__top">
                  <strong>{{ a.name }}</strong>
                  <span class="badge" [attr.data-type]="a.type">{{ a.type }}</span>
                </div>
                <div class="timeline__meta">
                  <span>{{ a.category }}</span>
                  <span>{{ a.durationMinutes | duration }}</span>
                </div>
                @if (a.notes) {
                  <p class="timeline__notes">{{ a.notes }}</p>
                }
              </div>
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: `:host { display: block; }`,
})
export class TimelineViewComponent {
  readonly activities = input.required<Activity[]>();
  readonly select = output<Activity>();

  sorted(): Activity[] {
    return [...this.activities()].sort(
      (a, b) => parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime),
    );
  }

  color(category: string): string {
    return getCategoryColor(category);
  }
}
