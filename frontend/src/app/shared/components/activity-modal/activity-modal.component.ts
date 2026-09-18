import { Component, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CATEGORIES } from '../../../core/constants/categories';
import { ActivityType } from '../../../core/models';
import { ActivityService } from '../../../core/services/activity.service';
import { ToastService } from '../../../core/services/toast.service';
import {
  calculateDuration,
  detectOverlappingActivities,
  getCategoryDefaultType,
} from '../../../core/utils/stats.utils';
import { ActivityModalService } from './activity-modal.service';
import { DurationPipe } from '../../pipes/format.pipes';

@Component({
  selector: 'app-activity-modal',
  standalone: true,
  imports: [FormsModule, DurationPipe],
  template: `
    @if (modal.state().open) {
      <div class="modal-backdrop" (click)="close()"></div>
      <aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="activity-modal-title">
        <header class="drawer__header">
          <h2 id="activity-modal-title">{{ modal.state().mode === 'edit' ? 'Edit activity' : 'Add activity' }}</h2>
          <button type="button" class="btn btn--ghost btn--icon" (click)="close()" aria-label="Close">×</button>
        </header>

        <form class="drawer__body form-grid" (ngSubmit)="save()">
          <label class="field">
            <span>Name</span>
            <input class="input" [(ngModel)]="name" name="name" required placeholder="What did you do?" />
          </label>

          <label class="field">
            <span>Category</span>
            <select class="input" [(ngModel)]="category" name="category" (ngModelChange)="onCategoryChange($event)">
              @for (c of categories; track c.name) {
                <option [value]="c.name">{{ c.name }}</option>
              }
            </select>
          </label>

          <label class="field">
            <span>Date</span>
            <input class="input" type="date" [(ngModel)]="date" name="date" required (ngModelChange)="onDateChange()" />
          </label>

          <div class="field-row">
            <label class="field">
              <span>From</span>
              <input class="input" type="time" [(ngModel)]="startTime" name="startTime" required (ngModelChange)="onTimeChange()" />
            </label>
            <label class="field">
              <span>To</span>
              <input class="input" type="time" [(ngModel)]="endTime" name="endTime" required (ngModelChange)="onTimeChange()" />
            </label>
          </div>
          @if (continueFrom) {
            <p class="muted tiny">Starts when {{ continueFrom }} ended.</p>
          }

          <p class="drawer__duration">
            Duration
            <strong>{{ durationMinutes() | duration }}</strong>
            @if (overnight()) {
              <span class="badge badge--muted">Overnight</span>
            }
          </p>

          <label class="field">
            <span>Type</span>
            <select class="input" [(ngModel)]="type" name="type">
              <option value="productive">Productive</option>
              <option value="neutral">Neutral</option>
              <option value="unproductive">Unproductive</option>
              <option value="sleep">Sleep</option>
            </select>
          </label>

          <label class="field">
            <span>Notes</span>
            <textarea class="input input--area" rows="3" [(ngModel)]="notes" name="notes" placeholder="Optional"></textarea>
          </label>

          @if (overlapText()) {
            <div class="alert alert--warning">{{ overlapText() }}</div>
          }

          <footer class="drawer__footer">
            <button type="button" class="btn btn--ghost" (click)="close()">Cancel</button>
            <button type="submit" class="btn btn--primary" [disabled]="!canSave()">Save</button>
          </footer>
        </form>
      </aside>
    }
  `,
  styles: `:host { display: contents; }`,
})
export class ActivityModalComponent {
  readonly modal = inject(ActivityModalService);
  private readonly activities = inject(ActivityService);
  private readonly toast = inject(ToastService);

  readonly categories = CATEGORIES;

  name = '';
  category = 'Coding';
  date = '';
  startTime = '09:00';
  endTime = '10:00';
  type: ActivityType = 'productive';
  notes = '';
  continueFrom = '';

  readonly durationMinutes = signal(60);
  readonly overnight = signal(false);
  readonly overlapText = signal('');

  constructor() {
    effect(() => {
      const s = this.modal.state();
      if (!s.open) return;
      if (s.mode === 'edit' && s.activity) {
        const a = s.activity;
        this.name = a.name;
        this.category = a.category;
        this.date = a.date;
        this.startTime = a.startTime;
        this.endTime = a.endTime;
        this.type = a.type;
        this.notes = a.notes ?? '';
        this.continueFrom = '';
      } else {
        const d = s.defaults ?? {};
        this.name = d.name ?? d.category ?? '';
        this.category = d.category ?? 'Coding';
        this.date = d.date ?? new Date().toISOString().slice(0, 10);
        const slot =
          d.startTime && d.endTime
            ? { startTime: d.startTime, endTime: d.endTime, afterName: d.continueFrom }
            : this.activities.nextSlot(this.date);
        this.startTime = slot.startTime;
        this.endTime = slot.endTime;
        this.continueFrom = slot.afterName ?? '';
        this.type = d.type ?? getCategoryDefaultType(this.category);
        this.notes = '';
      }
      this.syncMeta();
    });
  }

  onDateChange(): void {
    if (this.modal.state().mode === 'create') {
      const slot = this.activities.nextSlot(this.date);
      this.startTime = slot.startTime;
      this.endTime = slot.endTime;
      this.continueFrom = slot.afterName ?? '';
    }
    this.syncMeta();
  }

  onTimeChange(): void {
    this.continueFrom = '';
    this.syncMeta();
  }

  onCategoryChange(cat: string): void {
    this.type = getCategoryDefaultType(cat);
    if (!this.name.trim()) this.name = cat;
  }

  syncMeta(): void {
    const mins = calculateDuration(this.startTime, this.endTime, this.date);
    this.durationMinutes.set(mins);
    this.overnight.set(this.endTime <= this.startTime);
    this.overlapText.set(this.computeOverlap());
  }

  canSave(): boolean {
    return !!this.name.trim() && !!this.date && !!this.startTime && !!this.endTime && this.durationMinutes() > 0;
  }

  save(): void {
    this.syncMeta();
    if (!this.canSave()) return;
    const payload = {
      name: this.name,
      category: this.category,
      date: this.date,
      startTime: this.startTime,
      endTime: this.endTime,
      type: this.type,
      notes: this.notes,
    };
    const mode = this.modal.state().mode;
    if (mode === 'edit' && this.modal.state().activity) {
      this.activities.update(this.modal.state().activity!._id, payload);
      this.toast.success('Activity updated');
    } else {
      this.activities.create(payload);
      this.toast.success('Activity added');
    }
    if (this.overlapText()) {
      this.toast.warning('Saved with overlap — stats merge overlapping time.');
    }
    this.close();
  }

  close(): void {
    this.modal.close();
  }

  private computeOverlap(): string {
    if (!this.date || !this.startTime || !this.endTime) return '';
    const draftId = this.modal.state().activity?._id;
    const others = this.activities.getByDate(this.date).filter((a) => a._id !== draftId);
    const draft = {
      _id: 'draft',
      name: this.name || 'New',
      category: this.category,
      date: this.date,
      startTime: this.startTime,
      endTime: this.endTime,
      durationMinutes: calculateDuration(this.startTime, this.endTime, this.date),
      type: this.type,
      createdAt: '',
      updatedAt: '',
    };
    const pairs = detectOverlappingActivities([...others, draft], this.date);
    if (!pairs.length) return '';
    const names = pairs.map((p) => (p.aId === 'draft' ? p.bName : p.aName));
    return `Overlaps with: ${[...new Set(names)].join(', ')}. Time will be merged (not double-counted).`;
  }
}
