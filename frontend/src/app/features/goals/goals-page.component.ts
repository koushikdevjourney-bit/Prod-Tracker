import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GoalService } from '../../core/services/goal.service';
import { ToastService } from '../../core/services/toast.service';
import { GoalProgressComponent } from '../../shared/components/goal-progress/goal-progress.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { CATEGORIES } from '../../core/constants/categories';
import { Goal, GoalPeriod } from '../../core/models';
import { todayKey } from '../../core/utils/stats.utils';

@Component({
  selector: 'app-goals-page',
  standalone: true,
  imports: [FormsModule, GoalProgressComponent, EmptyStateComponent],
  template: `
    <section class="page">
      <header class="page-header page-header--row">
        <div>
          <p class="eyebrow">Goals</p>
          <h1>Targets & progress</h1>
          <p class="lede">Progress auto-updates from logged activities.</p>
        </div>
        <button type="button" class="btn btn--primary" (click)="startCreate()">+ Add Goal</button>
      </header>

      @if (editing()) {
        <form class="panel form-grid" (ngSubmit)="save()">
          <h3>{{ editId() ? 'Edit goal' : 'New goal' }}</h3>
          <label class="field">
            <span>Name</span>
            <input class="input" [(ngModel)]="name" name="name" required />
          </label>
          <label class="field">
            <span>Category (optional filter)</span>
            <select class="input" [(ngModel)]="category" name="category">
              <option value="">Any productive time</option>
              @for (c of categories; track c.name) {
                <option [value]="c.name">{{ c.name }}</option>
              }
            </select>
          </label>
          <label class="field">
            <span>Target hours</span>
            <input class="input" type="number" min="0.25" step="0.25" [(ngModel)]="targetHours" name="targetHours" required />
          </label>
          <label class="field">
            <span>Period</span>
            <select class="input" [(ngModel)]="period" name="period">
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </label>
          <label class="field">
            <span>Anchor date</span>
            <input class="input" type="date" [(ngModel)]="date" name="date" required />
          </label>
          <div class="form-actions">
            <button type="button" class="btn btn--ghost" (click)="cancel()">Cancel</button>
            <button type="submit" class="btn btn--primary">Save</button>
          </div>
        </form>
      }

      @if (goals.withProgress().length === 0 && !editing()) {
        <app-empty-state
          title="No goals yet"
          message="Set a daily deep-work target and watch progress fill from your log."
          actionLabel="+ Add Goal"
          (action)="startCreate()"
        />
      } @else {
        <div class="goal-stack">
          @for (g of goals.withProgress(); track g.goal._id) {
            <div class="panel goal-card">
              <app-goal-progress
                [name]="g.goal.name"
                [category]="g.goal.category || ''"
                [targetMinutes]="g.goal.targetMinutes"
                [loggedMinutes]="g.loggedMinutes"
                [progressPercent]="g.progressPercent"
              />
              <div class="goal-card__meta">
                <span class="badge badge--muted">{{ g.goal.period }}</span>
                <span class="muted">{{ g.goal.date }}</span>
                <div class="spacer"></div>
                <button type="button" class="btn btn--ghost btn--sm" (click)="startEdit(g.goal)">Edit</button>
                <button type="button" class="btn btn--ghost btn--sm btn--danger" (click)="remove(g.goal)">Delete</button>
              </div>
            </div>
          }
        </div>
      }
    </section>
  `,
  styles: `
    :host { display: block; }
    .page-header--row { display:flex; flex-wrap:wrap; justify-content:space-between; gap:1rem; margin-bottom:1.25rem; }
    .page-header h1 { margin:0.15rem 0 0.35rem; font-family:var(--font-display); letter-spacing:-0.03em; }
    .goal-stack { display:grid; gap:0.85rem; }
    .goal-card__meta { display:flex; flex-wrap:wrap; align-items:center; gap:0.5rem; margin-top:0.75rem; }
    .spacer { flex:1; }
    .form-actions { display:flex; justify-content:flex-end; gap:0.5rem; }
  `,
})
export class GoalsPageComponent {
  readonly goals = inject(GoalService);
  private readonly toast = inject(ToastService);
  readonly categories = CATEGORIES;

  readonly editing = signal(false);
  readonly editId = signal<string | null>(null);

  name = '';
  category = '';
  targetHours = 2;
  period: GoalPeriod = 'daily';
  date = todayKey();

  startCreate(): void {
    this.editId.set(null);
    this.name = '';
    this.category = '';
    this.targetHours = 2;
    this.period = 'daily';
    this.date = todayKey();
    this.editing.set(true);
  }

  startEdit(g: Goal): void {
    this.editId.set(g._id);
    this.name = g.name;
    this.category = g.category ?? '';
    this.targetHours = Math.round((g.targetMinutes / 60) * 100) / 100;
    this.period = g.period;
    this.date = g.date;
    this.editing.set(true);
  }

  cancel(): void {
    this.editing.set(false);
  }

  save(): void {
    const payload = {
      name: this.name,
      category: this.category || undefined,
      targetMinutes: Math.round(this.targetHours * 60),
      date: this.date,
      period: this.period,
    };
    if (this.editId()) {
      this.goals.update(this.editId()!, payload);
      this.toast.success('Goal updated');
    } else {
      this.goals.create(payload);
      this.toast.success('Goal added');
    }
    this.editing.set(false);
  }

  remove(g: Goal): void {
    if (!confirm(`Delete goal “${g.name}”?`)) return;
    this.goals.delete(g._id);
    this.toast.success('Goal deleted');
  }
}
