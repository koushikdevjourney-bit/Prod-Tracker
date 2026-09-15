import { Component, computed, inject, signal } from '@angular/core';
import { DateNavComponent } from '../../shared/components/date-nav/date-nav.component';
import { MetricCardComponent } from '../../shared/components/metric-card/metric-card.component';
import { TimeBreakdownComponent } from '../../shared/components/time-breakdown/time-breakdown.component';
import { ProductivityChartComponent } from '../../shared/components/productivity-chart/productivity-chart.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { AnalyticsService } from '../../core/services/analytics.service';
import { DateNavService } from '../../core/services/date-nav.service';
import { formatDuration } from '../../core/utils/stats.utils';

type Tab = 'daily' | 'weekly' | 'monthly';

@Component({
  selector: 'app-analytics-page',
  standalone: true,
  imports: [
    DateNavComponent,
    MetricCardComponent,
    TimeBreakdownComponent,
    ProductivityChartComponent,
    EmptyStateComponent,
  ],
  templateUrl: './analytics-page.component.html',
  styleUrl: './analytics-page.component.css',
})
export class AnalyticsPageComponent {
  private readonly analytics = inject(AnalyticsService);
  private readonly dates = inject(DateNavService);

  readonly tab = signal<Tab>('daily');

  readonly daily = computed(() => this.analytics.daily(this.dates.selectedDate()));
  readonly weekly = computed(() => this.analytics.weekly(this.dates.selectedDate()));
  readonly monthly = computed(() => this.analytics.monthly(this.dates.selectedDate()));

  readonly activeStats = computed(() => {
    const t = this.tab();
    if (t === 'weekly') return this.weekly().totals;
    if (t === 'monthly') return this.monthly().totals;
    const d = this.daily();
    return {
      ...d,
      avgProductivityPercent: d.productivityPercent,
      hasOverlaps: d.hasOverlaps,
      categoryBreakdown: d.categoryBreakdown,
    };
  });

  readonly dayBars = computed(() => {
    const t = this.tab();
    if (t === 'daily') return [this.daily()];
    if (t === 'weekly') return this.weekly().days;
    return this.monthly().days;
  });

  readonly isEmpty = computed(() => this.activeStats().activityCount === 0);

  setTab(tab: Tab): void {
    this.tab.set(tab);
  }

  barHeight(minutes: number): number {
    const max = Math.max(1, ...this.dayBars().map((d) => d.productiveMinutes));
    return (minutes / max) * 100;
  }

  label(date: string): string {
    return date.slice(5);
  }

  tip(date: string, minutes: number): string {
    return `${date}: ${formatDuration(minutes)} productive`;
  }
}
