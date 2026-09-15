import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DateNavService } from '../../../core/services/date-nav.service';
import { DateRangePreset } from '../../../core/models';
import { formatDisplayDate } from '../../../core/utils/stats.utils';

@Component({
  selector: 'app-date-nav',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="date-nav">
      <div class="date-nav__controls">
        <button type="button" class="btn btn--ghost btn--icon" (click)="dates.goPrev()" aria-label="Previous">
          ←
        </button>
        <button type="button" class="btn btn--ghost" (click)="dates.goToday()">Today</button>
        <button type="button" class="btn btn--ghost btn--icon" (click)="dates.goNext()" aria-label="Next">
          →
        </button>
      </div>

      <div class="date-nav__label">
        @if (dates.isSingleDay()) {
          <span>{{ displayDate() }}</span>
        } @else {
          <span>{{ dates.rangeStart() }} → {{ dates.rangeEnd() }}</span>
        }
      </div>

      <div class="date-nav__tools">
        <input
          class="input input--date"
          type="date"
          [ngModel]="dates.selectedDate()"
          (ngModelChange)="onPick($event)"
          aria-label="Pick date"
        />
        <select
          class="input input--select"
          [ngModel]="dates.selection().preset"
          (ngModelChange)="onPreset($event)"
          aria-label="Date range"
        >
          <option value="today">Today</option>
          <option value="yesterday">Yesterday</option>
          <option value="thisWeek">This week</option>
          <option value="lastWeek">Last week</option>
          <option value="thisMonth">This month</option>
          <option value="lastMonth">Last month</option>
          <option value="custom">Custom</option>
        </select>
      </div>
    </div>
  `,
  styles: `:host { display: block; }`,
})
export class DateNavComponent {
  readonly dates = inject(DateNavService);

  displayDate(): string {
    return formatDisplayDate(this.dates.selectedDate());
  }

  onPick(value: string): void {
    if (value) this.dates.setDate(value);
  }

  onPreset(preset: DateRangePreset): void {
    if (preset === 'custom') return;
    this.dates.setPreset(preset);
  }
}
