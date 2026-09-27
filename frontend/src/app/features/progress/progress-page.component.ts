import { Component, HostListener, OnDestroy, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ThemeService } from '../../core/services/theme.service';
import { ProgressService } from '../../core/services/progress.service';
import { AcademicService } from '../../core/services/academic.service';
import { GritService } from '../../core/services/grit.service';
import { ToastService } from '../../core/services/toast.service';
import { ActivityService } from '../../core/services/activity.service';
import { ProgressItem, FOCUS_LENGTHS, FOCUS_PRESETS, dueLabel } from '../../core/data/progress-catalog';
import { PRIMARY_STAR_MIN } from '../../core/data/academic-catalog';
import { formatDuration, todayKey } from '../../core/utils/stats.utils';

export type TimerMode = 'focus' | 'short_break' | 'long_break';

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
  private readonly activities = inject(ActivityService);

  readonly editingNote = signal<string | null>(null);
  readonly editingTitle = signal(false);
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

  // Interactive feature signals
  readonly timerMode = signal<TimerMode>('focus');
  readonly zenMode = signal(false);
  readonly soundEnabled = signal(true);
  readonly queueFilter = signal('');

  newTitle = '';
  intentionDraft = '';
  noteDraft = '';
  titleDraft = '';
  private timer: ReturnType<typeof setInterval> | null = null;
  private sessionItemId: string | null = null;

  readonly ringC = 2 * Math.PI * 18;
  readonly timerRingC = 2 * Math.PI * 34;

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.zenMode()) {
      this.zenMode.set(false);
    }
  }

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

  readonly filteredQueue = computed(() => {
    const filter = this.queueFilter().trim().toLowerCase();
    const list = this.progress.queue();
    if (!filter) return list;
    return list.filter(
      (item) =>
        item.title.toLowerCase().includes(filter) ||
        item.note.toLowerCase().includes(filter) ||
        item.source.toLowerCase().includes(filter),
    );
  });

  ngOnDestroy(): void {
    this.clearTimer();
  }

  toggleTheme(): void {
    this.theme.toggleLightDark();
  }

  toggleZen(): void {
    this.zenMode.update((v) => !v);
  }

  toggleSound(): void {
    this.soundEnabled.update((v) => !v);
    this.toast.info(this.soundEnabled() ? 'Sound chimes enabled' : 'Sound chimes muted');
  }

  ringOffset(): number {
    return this.ringC * (1 - this.progress.totals().percent / 100);
  }

  timerTotalSeconds(): number {
    if (this.timerMode() === 'short_break') return 5 * 60;
    if (this.timerMode() === 'long_break') return 15 * 60;
    return this.sessionLen() * 60;
  }

  timerRingOffset(): number {
    const total = this.timerTotalSeconds();
    if (!total || !this.remaining()) return 0;
    const progressFraction = (total - this.remaining()) / total;
    return this.timerRingC * (1 - Math.max(0, Math.min(1, progressFraction)));
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

  setTimerMode(mode: TimerMode): void {
    if (this.running()) {
      this.pauseSession();
    }
    this.timerMode.set(mode);
    const mins = mode === 'short_break' ? 5 : mode === 'long_break' ? 15 : this.sessionLen();
    this.remaining.set(mins * 60);
  }

  bumpTimer(seconds: number): void {
    const next = Math.max(60, this.remaining() + seconds);
    this.remaining.set(next);
  }

  setMilestone(id: string, percent: number): void {
    this.progress.setPercent(id, percent);
    this.toast.info(`Progress set to ${percent}%`);
  }

  markDoneAndNext(id: string): void {
    this.progress.toggleDone(id);
    this.toast.success('Task completed! Up next promoted to focus.');
  }

  startTitleEdit(item: ProgressItem): void {
    this.titleDraft = item.title;
    this.editingTitle.set(true);
  }

  saveTitleEdit(id: string): void {
    if (this.titleDraft.trim()) {
      this.progress.rename(id, this.titleDraft.trim());
    }
    this.editingTitle.set(false);
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
    if (!now && this.timerMode() === 'focus') {
      this.toast.info('Add or select a focus task first');
      return;
    }
    if (this.remaining() > 0 && (this.sessionItemId || this.timerMode() !== 'focus')) {
      this.running.set(true);
      this.clearTimer();
      this.timer = setInterval(() => this.tick(), 1000);
      return;
    }
    this.sessionItemId = now?.id ?? null;
    const totalSec = this.timerTotalSeconds();
    this.remaining.set(totalSec);
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
    const planned = this.timerTotalSeconds();
    const elapsedSec = completed ? planned : Math.max(0, planned - this.remaining());
    const minutes = Math.max(completed ? Math.round(planned / 60) : 1, Math.round(elapsedSec / 60));
    const mode = this.timerMode();
    const id = this.sessionItemId || this.progress.now()?.id;

    this.remaining.set(0);
    this.sessionItemId = null;

    if (completed) {
      this.playChime();
    }

    if (mode === 'focus') {
      if (!id || elapsedSec < 20) return;
      this.progress.addMinutes(id, minutes);
      if (completed) {
        this.toast.success(`🎉 Great focus! ${minutes}m logged.`);
        this.setTimerMode('short_break');
      }
    } else {
      if (completed) {
        this.toast.success('☕ Break finished! Ready to refocus.');
        this.setTimerMode('focus');
      }
    }
  }

  playChime(): void {
    if (!this.soundEnabled()) return;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      const playTone = (freq: number, start: number, dur: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.25, start);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + dur);
      };

      playTone(523.25, now, 0.35);
      playTone(659.25, now + 0.14, 0.35);
      playTone(783.99, now + 0.28, 0.55);
    } catch {
      // Graceful fallback if audio context fails
    }
  }

  logNowToActivity(): void {
    const now = this.progress.now();
    if (!now) {
      this.toast.info('No active focus item to log');
      return;
    }
    const slot = this.activities.nextSlot(this.today);
    this.activities.create({
      name: now.title,
      category: now.source === 'Custom' ? 'Work' : now.source.split(' ')[0] || 'Work',
      date: this.today,
      startTime: slot.startTime,
      endTime: slot.endTime,
      type: 'productive',
      notes: now.note || `Progress tracker session (${now.percent}% completed)`,
    });
    this.toast.success(`Logged "${now.title}" to Activity journal!`);
  }

  clearAllCleared(): void {
    this.progress.clearCleared();
    this.toast.info('Cleared history emptied');
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
