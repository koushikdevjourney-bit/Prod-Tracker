import { Component, input } from '@angular/core';
import { DurationPipe, PercentFmtPipe } from '../../pipes/format.pipes';

@Component({
  selector: 'app-metric-card',
  standalone: true,
  imports: [DurationPipe, PercentFmtPipe],
  template: `
    <div class="metric-card" [class.metric-card--accent]="accent()">
      <p class="metric-card__label">{{ label() }}</p>
      <p class="metric-card__value">
        @if (kind() === 'duration') {
          {{ value() | duration }}
        } @else if (kind() === 'percent') {
          {{ value() | percentFmt }}
        } @else {
          {{ display() || value() }}
        }
      </p>
      @if (hint()) {
        <p class="metric-card__hint">{{ hint() }}</p>
      }
    </div>
  `,
  styles: `
    :host { display: block; }
  `,
})
export class MetricCardComponent {
  readonly label = input.required<string>();
  readonly value = input<number>(0);
  readonly display = input<string>('');
  readonly hint = input<string>('');
  readonly kind = input<'duration' | 'percent' | 'text'>('duration');
  readonly accent = input(false);
}
