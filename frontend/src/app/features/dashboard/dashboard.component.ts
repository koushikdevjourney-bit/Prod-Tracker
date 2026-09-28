import { Component, computed, inject } from '@angular/core';
import { MetricCardComponent } from '../../shared/components/metric-card/metric-card.component';
import { DateNavComponent } from '../../shared/components/date-nav/date-nav.component';
import { TimelineViewComponent } from '../../shared/components/timeline-view/timeline-view.component';
import { SleepCardComponent } from '../../shared/components/sleep-card/sleep-card.component';
import { TimeBreakdownComponent } from '../../shared/components/time-breakdown/time-breakdown.component';
import { ProductivityChartComponent } from '../../shared/components/productivity-chart/productivity-chart.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { ActivityModalService } from '../../shared/components/activity-modal/activity-modal.service';
import { AnalyticsService } from '../../core/services/analytics.service';
import { ActivityService } from '../../core/services/activity.service';
import { DateNavService } from '../../core/services/date-nav.service';
import { SleepService } from '../../core/services/sleep.service';
import { SettingsService } from '../../core/services/settings.service';
import { QUICK_ADD_PRESETS } from '../../core/constants/categories';
import { Activity } from '../../core/models';
import { greetingForNow } from '../../core/utils/stats.utils';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    MetricCardComponent,
    DateNavComponent,
    TimelineViewComponent,
    SleepCardComponent,
    TimeBreakdownComponent,
    ProductivityChartComponent,
    EmptyStateComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent {
  private readonly analytics = inject(AnalyticsService);
  private readonly activities = inject(ActivityService);
  private readonly dates = inject(DateNavService);
  private readonly sleep = inject(SleepService);
  private readonly settings = inject(SettingsService);
  private readonly modal = inject(ActivityModalService);

  readonly presets = QUICK_ADD_PRESETS;

  readonly greeting = greetingForNow();
  readonly displayName = computed(() => this.settings.settings().displayName);

  readonly stats = computed(() => this.analytics.selectedDayStats());
  readonly dayActivities = computed(() => this.activities.getByDate(this.dates.selectedDate()));
  readonly sleepSummary = computed(() => this.sleep.summaryFor(this.dates.selectedDate()));
  readonly insights = computed(() => this.analytics.insightsFor(this.dates.selectedDate()));
  readonly isEmpty = computed(() => this.stats().activityCount === 0);

  addActivity(): void {
    const date = this.dates.selectedDate();
    const slot = this.activities.nextSlot(date);
    this.modal.openCreate({
      date,
      startTime: slot.startTime,
      endTime: slot.endTime,
      continueFrom: slot.afterName,
    });
  }

  quickAdd(category: string, type: Activity['type']): void {
    const date = this.dates.selectedDate();
    const slot = this.activities.nextSlot(date);
    this.modal.openCreate({
      date,
      category,
      type,
      name: category,
      startTime: slot.startTime,
      endTime: slot.endTime,
      continueFrom: slot.afterName,
    });
  }

  editActivity(a: Activity): void {
    this.modal.openEdit(a);
  }
}
