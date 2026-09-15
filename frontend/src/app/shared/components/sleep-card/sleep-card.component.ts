import { Component, input } from '@angular/core';
import { SleepSummary } from '../../../core/models';
import { DurationPipe } from '../../pipes/format.pipes';

@Component({
  selector: 'app-sleep-card',
  standalone: true,
  imports: [DurationPipe],
  template: `
    <div class="panel-block">
      <div class="panel-block__head">
        <h3>Sleep</h3>
      </div>
      @if (summary().durationMinutes === 0) {
        <p class="muted">No sleep logged for this day. Add a Sleep activity (overnight supported).</p>
      } @else {
        <div class="sleep-stats">
          <div>
            <p class="metric-card__label">Logged</p>
            <p class="metric-card__value">{{ summary().durationMinutes | duration }}</p>
          </div>
          <div>
            <p class="metric-card__label">Target</p>
            <p class="metric-card__value">{{ summary().targetMinutes | duration }}</p>
          </div>
          <div>
            <p class="metric-card__label">{{ summary().deficitMinutes >= 0 ? 'Surplus' : 'Deficit' }}</p>
            <p class="metric-card__value" [class.text-ok]="summary().deficitMinutes >= 0" [class.text-warn]="summary().deficitMinutes < 0">
              {{ abs(summary().deficitMinutes) | duration }}
            </p>
          </div>
          <div>
            <p class="metric-card__label">7-day avg</p>
            <p class="metric-card__value">
              @if (summary().weeklyAverageMinutes > 0) {
                {{ summary().weeklyAverageMinutes | duration }}
              } @else {
                —
              }
            </p>
          </div>
        </div>
      }
    </div>
  `,
  styles: `:host { display: block; }`,
})
export class SleepCardComponent {
  readonly summary = input.required<SleepSummary>();

  abs(n: number): number {
    return Math.abs(n);
  }
}
