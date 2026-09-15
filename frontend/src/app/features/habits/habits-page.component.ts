import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HabitService } from '../../core/services/habit.service';
import { ToastService } from '../../core/services/toast.service';
import { HabitListComponent } from '../../shared/components/habit-list/habit-list.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { Habit } from '../../core/models';

@Component({
  selector: 'app-habits-page',
  standalone: true,
  imports: [FormsModule, HabitListComponent, EmptyStateComponent],
  template: `
    <section class="page">
      <header class="page-header page-header--row">
        <div>
          <p class="eyebrow">Habits</p>
          <h1>Streaks & consistency</h1>
        </div>
        <button type="button" class="btn btn--primary" (click)="startCreate()">+ Add Habit</button>
      </header>

      @if (editing()) {
        <form class="panel form-grid" (ngSubmit)="save()">
          <h3>{{ editId() ? 'Edit habit' : 'New habit' }}</h3>
          <label class="field">
            <span>Name</span>
            <input class="input" [(ngModel)]="name" name="name" required />
          </label>
          <label class="field">
            <span>Description</span>
            <input class="input" [(ngModel)]="description" name="description" />
          </label>
          <label class="field">
            <span>Target days / week</span>
            <input class="input" type="number" min="1" max="7" [(ngModel)]="targetDays" name="targetDays" />
          </label>
          <label class="field">
            <span>Color</span>
            <input class="input" type="color" [(ngModel)]="color" name="color" />
          </label>
          <div class="form-actions">
            <button type="button" class="btn btn--ghost" (click)="editing.set(false)">Cancel</button>
            <button type="submit" class="btn btn--primary">Save</button>
          </div>
        </form>
      }

      @if (habits.withStreaks().length === 0 && !editing()) {
        <app-empty-state
          title="No habits"
          message="Track small daily commitments and build streaks."
          actionLabel="+ Add Habit"
          (action)="startCreate()"
        />
      } @else {
        <div class="panel">
          <app-habit-list [rows]="habits.withStreaks()" (toggle)="toggle($event)" />
        </div>
        <div class="habit-manage">
          @for (row of habits.withStreaks(); track row.habit._id) {
            <div class="habit-manage__row">
              <span>{{ row.habit.name }}</span>
              <button type="button" class="btn btn--ghost btn--sm" (click)="startEdit(row.habit)">Edit</button>
              <button type="button" class="btn btn--ghost btn--sm btn--danger" (click)="remove(row.habit)">Delete</button>
            </div>
          }
        </div>
      }
    </section>
  `,
  styles: `
    :host { display: block; }
    .page-header--row { display:flex; flex-wrap:wrap; justify-content:space-between; gap:1rem; margin-bottom:1.25rem; }
    .page-header h1 { margin:0.15rem 0 0; font-family:var(--font-display); letter-spacing:-0.03em; }
    .form-actions { display:flex; justify-content:flex-end; gap:0.5rem; }
    .habit-manage { margin-top:1rem; display:grid; gap:0.35rem; }
    .habit-manage__row { display:flex; align-items:center; gap:0.5rem; }
    .habit-manage__row span { flex:1; }
  `,
})
export class HabitsPageComponent {
  readonly habits = inject(HabitService);
  private readonly toast = inject(ToastService);

  readonly editing = signal(false);
  readonly editId = signal<string | null>(null);

  name = '';
  description = '';
  targetDays = 5;
  color = '#0d9488';

  startCreate(): void {
    this.editId.set(null);
    this.name = '';
    this.description = '';
    this.targetDays = 5;
    this.color = '#0d9488';
    this.editing.set(true);
  }

  startEdit(h: Habit): void {
    this.editId.set(h._id);
    this.name = h.name;
    this.description = h.description ?? '';
    this.targetDays = h.targetDaysPerWeek;
    this.color = h.color || '#0d9488';
    this.editing.set(true);
  }

  save(): void {
    const payload = {
      name: this.name,
      description: this.description,
      targetDaysPerWeek: this.targetDays,
      color: this.color,
    };
    if (this.editId()) {
      this.habits.update(this.editId()!, payload);
      this.toast.success('Habit updated');
    } else {
      this.habits.create(payload);
      this.toast.success('Habit added');
    }
    this.editing.set(false);
  }

  toggle(id: string): void {
    this.habits.toggleComplete(id);
  }

  remove(h: Habit): void {
    if (!confirm(`Delete habit “${h.name}”?`)) return;
    this.habits.delete(h._id);
    this.toast.success('Habit deleted');
  }
}
