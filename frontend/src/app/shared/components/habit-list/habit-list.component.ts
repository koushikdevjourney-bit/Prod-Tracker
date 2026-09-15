import { Component, input, output } from '@angular/core';
import { Habit } from '../../../core/models';

export interface HabitRow {
  habit: Habit;
  streak: number;
  completedToday: boolean;
  weekCount: number;
}

@Component({
  selector: 'app-habit-list',
  standalone: true,
  template: `
    <ul class="habit-list">
      @for (row of rows(); track row.habit._id) {
        <li class="habit-list__item">
          <button
            type="button"
            class="habit-check"
            [class.habit-check--on]="row.completedToday"
            [style.--habit]="row.habit.color || 'var(--accent)'"
            (click)="toggle.emit(row.habit._id)"
            [attr.aria-pressed]="row.completedToday"
            [attr.aria-label]="'Mark ' + row.habit.name"
          >
            @if (row.completedToday) { ✓ }
          </button>
          <div class="habit-list__meta">
            <strong>{{ row.habit.name }}</strong>
            <span class="muted">
              {{ row.weekCount }}/{{ row.habit.targetDaysPerWeek }} this week
              · {{ row.streak }} day streak
            </span>
          </div>
        </li>
      }
    </ul>
  `,
  styles: `:host { display: block; }`,
})
export class HabitListComponent {
  readonly rows = input.required<HabitRow[]>();
  readonly toggle = output<string>();
}
