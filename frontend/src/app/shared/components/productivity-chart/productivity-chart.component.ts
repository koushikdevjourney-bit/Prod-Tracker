import { Component, input } from '@angular/core';
import { CategoryBreakdownItem, TypeBreakdown } from '../../../core/models';
import { DurationPipe, PercentFmtPipe } from '../../pipes/format.pipes';

@Component({
  selector: 'app-productivity-chart',
  standalone: true,
  imports: [DurationPipe, PercentFmtPipe],
  template: `
    <div class="chart-grid">
      <div class="donut-wrap">
        <svg viewBox="0 0 42 42" class="donut" aria-hidden="true">
          <circle class="donut__track" cx="21" cy="21" r="15.915" />
          @for (arc of arcs(); track arc.key) {
            <circle
              class="donut__seg"
              cx="21"
              cy="21"
              r="15.915"
              [attr.stroke]="arc.color"
              [attr.stroke-dasharray]="arc.dash"
              [attr.stroke-dashoffset]="arc.offset"
            />
          }
        </svg>
        <div class="donut__center">
          <strong>{{ productivityPercent() | percentFmt }}</strong>
          <span>productivity</span>
        </div>
      </div>

      <div class="bar-list">
        <p class="panel-block__sub">Where did my time go?</p>
        @if (categories().length === 0) {
          <p class="muted">No category data.</p>
        } @else {
          @for (c of categories(); track c.category) {
            <div class="bar-row">
              <div class="bar-row__label">
                <span class="swatch" [style.background]="c.color"></span>
                {{ c.category }}
                <span class="muted">{{ c.minutes | duration }}</span>
              </div>
              <div class="progress">
                <div class="progress__bar" [style.width.%]="barWidth(c.minutes)" [style.background]="c.color"></div>
              </div>
            </div>
          }
        }
      </div>
    </div>
  `,
  styles: `:host { display: block; }`,
})
export class ProductivityChartComponent {
  readonly categories = input.required<CategoryBreakdownItem[]>();
  readonly typeBreakdown = input.required<TypeBreakdown>();
  readonly productivityPercent = input.required<number>();

  private totalCat(): number {
    return Math.max(1, this.categories().reduce((s, c) => s + c.minutes, 0));
  }

  barWidth(minutes: number): number {
    return (minutes / this.totalCat()) * 100;
  }

  arcs() {
    const b = this.typeBreakdown();
    const parts = [
      { key: 'p', minutes: b.productive, color: 'var(--type-productive)' },
      { key: 'n', minutes: b.neutral, color: 'var(--type-neutral)' },
      { key: 'u', minutes: b.unproductive, color: 'var(--type-unproductive)' },
      { key: 's', minutes: b.sleep, color: 'var(--type-sleep)' },
      { key: 'x', minutes: b.untracked, color: 'var(--type-untracked)' },
    ];
    const total = Math.max(1, parts.reduce((s, p) => s + p.minutes, 0));
    let cursor = 25; // start at top
    return parts
      .filter((p) => p.minutes > 0)
      .map((p) => {
        const pct = (p.minutes / total) * 100;
        const dash = `${pct} ${100 - pct}`;
        const offset = cursor;
        cursor -= pct;
        return { key: p.key, color: p.color, dash, offset };
      });
  }
}
