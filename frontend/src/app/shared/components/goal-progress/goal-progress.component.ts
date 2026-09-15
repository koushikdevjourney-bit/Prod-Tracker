import { Component, input } from '@angular/core';
import { DurationPipe, PercentFmtPipe } from '../../pipes/format.pipes';

@Component({
  selector: 'app-goal-progress',
  standalone: true,
  imports: [DurationPipe, PercentFmtPipe],
  template: `
    <div class="goal-row">
      <div class="goal-row__head">
        <div>
          <strong>{{ name() }}</strong>
          @if (category()) {
            <span class="muted"> · {{ category() }}</span>
          }
        </div>
        <span class="muted">{{ loggedMinutes() | duration }} / {{ targetMinutes() | duration }}</span>
      </div>
      <div class="progress" role="progressbar" [attr.aria-valuenow]="progressPercent()" aria-valuemin="0" aria-valuemax="100">
        <div class="progress__bar" [style.width.%]="progressPercent()"></div>
      </div>
      <span class="goal-row__pct">{{ progressPercent() | percentFmt }}</span>
    </div>
  `,
  styles: `:host { display: block; }`,
})
export class GoalProgressComponent {
  readonly name = input.required<string>();
  readonly category = input<string>('');
  readonly targetMinutes = input.required<number>();
  readonly loggedMinutes = input.required<number>();
  readonly progressPercent = input.required<number>();
}
