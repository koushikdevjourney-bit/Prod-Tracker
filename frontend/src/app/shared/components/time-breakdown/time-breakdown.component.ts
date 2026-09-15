import { Component, input } from '@angular/core';
import { TypeBreakdown } from '../../../core/models';
import { DurationPipe, PercentFmtPipe } from '../../pipes/format.pipes';
import { MINUTES_PER_DAY } from '../../../core/constants/categories';

@Component({
  selector: 'app-time-breakdown',
  standalone: true,
  imports: [DurationPipe, PercentFmtPipe],
  template: `
    <div class="breakdown">
      <div class="breakdown__bar" aria-hidden="true">
        @for (seg of segments(); track seg.key) {
          <div
            class="breakdown__seg"
            [style.flex-grow]="seg.minutes"
            [style.background]="seg.color"
            [title]="seg.label + ': ' + seg.minutes"
          ></div>
        }
      </div>
      <ul class="breakdown__legend">
        @for (seg of segments(); track seg.key) {
          <li>
            <span class="swatch" [style.background]="seg.color"></span>
            <span>{{ seg.label }}</span>
            <strong>{{ seg.minutes | duration }}</strong>
            <span class="muted">{{ (seg.minutes / day) * 100 | percentFmt }}</span>
          </li>
        }
      </ul>
      <p class="muted tiny">Untracked = 24h − logged time. Untracked is not unproductive.</p>
    </div>
  `,
  styles: `:host { display: block; }`,
})
export class TimeBreakdownComponent {
  readonly breakdown = input.required<TypeBreakdown>();
  readonly day = MINUTES_PER_DAY;

  segments() {
    const b = this.breakdown();
    return [
      { key: 'productive', label: 'Productive', minutes: b.productive, color: 'var(--type-productive)' },
      { key: 'neutral', label: 'Neutral', minutes: b.neutral, color: 'var(--type-neutral)' },
      { key: 'unproductive', label: 'Unproductive', minutes: b.unproductive, color: 'var(--type-unproductive)' },
      { key: 'sleep', label: 'Sleep', minutes: b.sleep, color: 'var(--type-sleep)' },
      { key: 'untracked', label: 'Untracked', minutes: b.untracked, color: 'var(--type-untracked)' },
    ].filter((s) => s.minutes > 0);
  }
}
