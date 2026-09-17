import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ThemeService } from '../../core/services/theme.service';
import { GritService } from '../../core/services/grit.service';
import { ToastService } from '../../core/services/toast.service';
import {
  GRIT_LEVELS,
  GRIT_RESULT_LABEL,
  GritBand,
  GritLevelDef,
  GritProgress,
  GritResult,
  GritSubjectDef,
  GritTarget,
  findGritSubject,
  milesForResult,
} from '../../core/data/grit-catalog';

type GritView = 'open' | 'cleared' | 'all';

@Component({
  selector: 'app-grit-page',
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: './grit-page.component.html',
  styleUrl: './grit-page.component.css',
})
export class GritPageComponent {
  readonly theme = inject(ThemeService);
  readonly grit = inject(GritService);
  private readonly toast = inject(ToastService);

  readonly levels = GRIT_LEVELS;
  readonly labels = GRIT_RESULT_LABEL;
  readonly markResults: GritResult[] = ['gold', 'silver', 'retry'];
  readonly views: Array<{ id: GritView; label: string }> = [
    { id: 'open', label: 'To do' },
    { id: 'cleared', label: 'Cleared' },
    { id: 'all', label: 'All' },
  ];

  readonly pick: Record<number, string> = { 1: '', 2: '' };
  readonly draggingId = signal<string | null>(null);
  readonly activeLevel = signal(1);
  readonly view = signal<GritView>('open');
  query = '';

  readonly ringC = 2 * Math.PI * 18;

  toggleTheme(): void {
    this.theme.toggleLightDark();
  }

  current(): GritLevelDef {
    return this.levels.find((l) => l.level === this.activeLevel()) ?? this.levels[0];
  }

  stats(level: GritLevelDef) {
    return this.grit.levelStats(level.level, level.subjects);
  }

  levelPercent(level: GritLevelDef): number {
    const { cleared, total } = this.stats(level);
    return total ? Math.round((cleared / total) * 100) : 0;
  }

  remainingMiles(): number {
    const t = this.grit.totals();
    return Math.max(0, t.maxMiles - t.miles);
  }

  ringOffset(): number {
    return this.ringC * (1 - this.grit.totals().percent / 100);
  }

  climb(level: number): GritProgress[] {
    return this.grit.climbFor(level);
  }

  available(level: GritLevelDef): GritSubjectDef[] {
    return this.grit.availableForClimb(level.level, level.subjects);
  }

  open(level: GritLevelDef): GritSubjectDef[] {
    return this.grit.openSubjects(level.level, level.subjects);
  }

  done(level: GritLevelDef) {
    return this.grit.completedSubjects(level.level, level.subjects);
  }

  shown(level: GritLevelDef): GritSubjectDef[] {
    const q = this.query.trim().toLowerCase();
    let list: GritSubjectDef[] = [];
    if (this.view() === 'open') list = this.open(level);
    else if (this.view() === 'cleared') list = this.done(level);
    else list = level.subjects;
    if (!q) return list;
    return list.filter(
      (s) => s.subject.toLowerCase().includes(q) || s.format.toLowerCase().includes(q),
    );
  }

  nextClimb(level: number): GritProgress | null {
    return this.climb(level).find((r) => r.result === 'none') ?? null;
  }

  result(level: number, subject: string): GritResult {
    return this.grit.resultOf(level, subject);
  }

  defFor(row: GritProgress): GritSubjectDef | undefined {
    return findGritSubject(row.level, row.subject);
  }

  targetMiles(row: GritProgress): number {
    const def = this.defFor(row);
    if (!def) return 0;
    return row.target === 'gold' ? def.gold.miles : def.silver.miles;
  }

  bandOf(def: GritSubjectDef, result: GritResult): GritBand {
    if (result === 'gold') return def.gold;
    if (result === 'silver') return def.silver;
    return def.retry;
  }

  addClimb(level: number): void {
    const subject = this.pick[level];
    if (!subject) return;
    this.grit.addToClimb(level, subject);
    this.pick[level] = '';
    this.toast.info(`Queued ${subject}`);
  }

  setTarget(row: GritProgress, target: GritTarget): void {
    this.grit.setTarget(row.level, row.subject, target);
  }

  mark(level: number, subject: string, result: GritResult): void {
    const def = findGritSubject(level, subject);
    this.grit.mark(level, subject, result);
    const after = this.grit.resultOf(level, subject);
    if (after === 'none') {
      this.toast.info(`${subject} is open again`);
      return;
    }
    const miles = def ? milesForResult(def, after) : 0;
    const kind = after === 'retry' ? 'warning' : 'success';
    this.toast.show(`${this.labels[after]} on ${subject} · +${miles} miles`, kind);
  }

  reset(level: number, subject: string): void {
    this.grit.mark(level, subject, this.grit.resultOf(level, subject));
    this.toast.info(`${subject} is open again`);
  }

  moveClimb(level: number, row: GritProgress, dir: -1 | 1): void {
    const list = this.climb(level);
    const i = list.findIndex((r) => r.id === row.id);
    const over = list[i + dir];
    if (over) this.grit.reorderClimb(level, row.id, over.id);
  }

  onDragStart(id: string): void {
    this.draggingId.set(id);
  }

  onDragOver(level: number, overId: string, event: DragEvent): void {
    event.preventDefault();
    const dragged = this.draggingId();
    if (dragged) this.grit.reorderClimb(level, dragged, overId);
  }

  onDragEnd(): void {
    this.draggingId.set(null);
  }
}
