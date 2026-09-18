import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ThemeService } from '../../core/services/theme.service';
import { ProgressService } from '../../core/services/progress.service';
import { AcademicService } from '../../core/services/academic.service';
import { GritService } from '../../core/services/grit.service';
import { ToastService } from '../../core/services/toast.service';
import { ProgressItem, FOCUS_LENGTHS, FOCUS_PRESETS, dueLabel } from '../../core/data/progress-catalog';
import { PRIMARY_STAR_MIN } from '../../core/data/academic-catalog';
import { formatDuration, todayKey } from '../../core/utils/stats.utils';

@Component({
  selector: 'app-progress-page',
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: './progress-page.component.html',
  styleUrl: './progress-page.component.css',
})
export class ProgressPageComponent implements OnDestroy {
  readonly theme = inject(ThemeService);
  readonly progress = inject(ProgressService);
  private readonly academics = inject(AcademicService);
  private readonly grit = inject(GritService);
  private readonly toast = inject(ToastService);

  readonly editingNote = signal<string | null>(null);
  readonly editingIntention = signal(false);
  readonly showCleared = signal(false);
  readonly draggingId = signal<string | null>(null);
  readonly sessionLen = signal<(typeof FOCUS_LENGTHS)[number]>(25);
  readonly remaining = signal(0);
  readonly running = signal(false);
  readonly addAsNow = signal(false);
  readonly today = todayKey();
  readonly lengths = FOCUS_LENGTHS;
  readonly presets = FOCUS_PRESETS;

  newTitle = '';
  intentionDraft = '';
  noteDraft = '';
  private timer: ReturnType<typeof setInterval> | null = null;
  private sessionItemId: string | null = null;

  readonly ringC = 2 * Math.PI * 18;

  readonly suggestions = computed(() => {
    const taken = new Set(this.progress.items().map((item) => item.title.toLowerCase()));
    const fromAcademics = this.academics.tracks().flatMap((track) =>
      track.subjects
        .filter((subject) => subject.stars >= PRIMARY_STAR_MIN)
        .map((subject) => ({ title: subject.name, source: track.name })),
    );
    const fromGrit = this.grit
      .rows()
      .filter((row) => row.inClimb && row.result === 'none')
      .map((row) => ({ title: row.subject, source: `Grit L${row.level}` }));
    const fromPresets = this.presets.map((title) => ({ title, source: 'Quick' }));
    return [...fromPresets, ...fromAcademics, ...fromGrit]
      .filter((item) => !taken.has(item.title.toLowerCase()))
      .slice(0, 8);
  });

  ngOnDestroy(): void {
    this.clearTimer();
  }

  toggleTheme(): void {
    this.theme.toggleLightDark();
  }

  ringOffset(): number {
    return this.ringC * (1 - this.progress.totals().percent / 100);
  }

  clock(): string {
    const total = this.remaining();
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  todayMinutes(): string {
    return formatDuration(this.progress.state().focusMinutesToday || 0);
  }

  itemDue(item: ProgressItem) {
    return dueLabel(item.due, this.today);
  }

  addCustom(): void {
    this.progress.add(this.newTitle, 'Custom', this.addAsNow());
    this.newTitle = '';
  }

  addSuggestion(title: string, source: string): void {
    this.progress.add(title, source, this.addAsNow());
  }

  startIntention(): void {
    this.intentionDraft = this.progress.state().intention;
    this.editingIntention.set(true);
  }

  saveIntention(): void {
    this.progress.setIntention(this.intentionDraft);
    this.editingIntention.set(false);
  }

  startNote(item: ProgressItem): void {
    this.noteDraft = item.note;
    this.editingNote.set(item.id);
  }

  saveNote(id: string): void {
    this.progress.setNote(id, this.noteDraft);
    this.editingNote.set(null);
  }

  startSession(): void {
    const now = this.progress.now();
    if (!now) return;
    if (this.remaining() > 0 && this.sessionItemId) {
      this.running.set(true);
      this.clearTimer();
      this.timer = setInterval(() => this.tick(), 1000);
      return;
    }
    this.sessionItemId = now.id;
    this.remaining.set(this.sessionLen() * 60);
    this.running.set(true);
    this.clearTimer();
    this.timer = setInterval(() => this.tick(), 1000);
  }

  private tick(): void {
    const next = this.remaining() - 1;
    if (next <= 0) {
      this.finishSession(true);
      return;
    }
    this.remaining.set(next);
  }

  pauseSession(): void {
    this.running.set(false);
    this.clearTimer();
  }

  stopSession(): void {
    this.finishSession(false);
  }

  private finishSession(completed: boolean): void {
    this.clearTimer();
    this.running.set(false);
    const planned = this.sessionLen() * 60;
    const elapsedSec = completed ? planned : Math.max(0, planned - this.remaining());
    const minutes = Math.max(completed ? this.sessionLen() : 1, Math.round(elapsedSec / 60));
    const id = this.sessionItemId || this.progress.now()?.id;
    this.remaining.set(0);
    this.sessionItemId = null;
    if (!id || elapsedSec < 20) return;
    this.progress.addMinutes(id, minutes);
    if (completed) this.toast.success(`${minutes}m focus session logged`);
  }

  private clearTimer(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  onDragStart(id: string, event: DragEvent): void {
    this.draggingId.set(id);
    event.dataTransfer?.setData('text/plain', id);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  onDrop(overId: string, event: DragEvent): void {
    event.preventDefault();
    const dragged = this.draggingId();
    if (dragged) this.progress.reorderOpen(dragged, overId);
    this.draggingId.set(null);
  }

  allowDrop(event: DragEvent): void {
    event.preventDefault();
  }
}
