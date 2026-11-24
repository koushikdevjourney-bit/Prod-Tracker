import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ThemeService } from '../../core/services/theme.service';
import { GritService } from '../../core/services/grit.service';
import { ToastService } from '../../core/services/toast.service';
import { ProgressService } from '../../core/services/progress.service';
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
export type GritTab = 'overall' | number;

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
  readonly progress = inject(ProgressService);
  private readonly toast = inject(ToastService);

  readonly levels = GRIT_LEVELS;
  readonly labels = GRIT_RESULT_LABEL;
  readonly markResults: GritResult[] = ['gold', 'silver', 'retry'];
  readonly views: Array<{ id: GritView; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'open', label: 'To do' },
    { id: 'cleared', label: 'Cleared' },
  ];

  readonly pick: Record<number, string> = { 1: '', 2: '', 3: '' };
  pickOverall = '';
  readonly activeTab = signal<GritTab>('overall');
  readonly activeLevel = signal<number>(1);
  readonly overallLevelFilter = signal<number | 'all'>('all');
  readonly draggingId = signal<string | null>(null);
  readonly view = signal<GritView>('open');
  query = '';

  readonly ringC = 2 * Math.PI * 18;

  selectTab(tab: GritTab): void {
    this.activeTab.set(tab);
    if (typeof tab === 'number') {
      this.activeLevel.set(tab);
    }
    this.view.set('open');
  }

  isOverall(): boolean {
    return this.activeTab() === 'overall';
  }

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

  // --- Overall climb & subjects ---

  overallClimb(): GritProgress[] {
    return this.grit.overallClimb();
  }

  nextClimbOverall(): GritProgress | null {
    return this.overallClimb().find((r) => r.result === 'none') ?? null;
  }

  availableForOverall(level?: number): Array<GritSubjectDef & { level: number }> {
    const all = this.grit.availableForOverallClimb();
    return level ? all.filter((s) => s.level === level) : all;
  }

  addClimbOverall(): void {
    if (!this.pickOverall) return;
    const [levelStr, ...rest] = this.pickOverall.split('::');
    const level = Number(levelStr);
    const subject = rest.join('::');
    if (!level || !subject) return;
    this.grit.addToClimb(level, subject);
    this.pickOverall = '';
    this.toast.info(`Queued L${level} · ${subject}`);
  }

  moveClimbOverall(row: GritProgress, dir: -1 | 1): void {
    this.grit.moveOverallClimb(row.id, dir);
  }

  onDragOverOverall(overId: string, event: DragEvent): void {
    event.preventDefault();
    const dragged = this.draggingId();
    if (dragged) this.grit.reorderOverallClimb(dragged, overId);
  }

  hasCompletedInOverallClimb(): boolean {
    return this.overallClimb().some((r) => r.result !== 'none');
  }

  queueAllRemainingOverall(): void {
    const count = this.grit.availableForOverallClimb().length;
    if (count === 0) {
      this.toast.info('All subjects are already in climb or cleared');
      return;
    }
    this.grit.queueAllRemaining();
    this.toast.show(`Added ${count} subjects to overall climb`, 'success');
  }

  clearCompletedOverall(): void {
    this.grit.clearCompletedFromClimb();
    this.toast.info('Cleared completed subjects from climb');
  }

  shownOverall(): Array<GritSubjectDef & { level: number }> {
    const q = this.query.trim().toLowerCase();
    const lvlFilter = this.overallLevelFilter();

    let list: Array<GritSubjectDef & { level: number }> = [];
    if (this.view() === 'open') {
      list = this.grit.openSubjectsOverall();
    } else if (this.view() === 'cleared') {
      list = this.grit.completedSubjectsOverall();
    } else {
      list = this.levels.flatMap((lvl) => lvl.subjects.map((s) => ({ ...s, level: lvl.level })));
    }

    if (lvlFilter !== 'all') {
      list = list.filter((s) => s.level === lvlFilter);
    }

    if (!q) return list;
    return list.filter(
      (s) =>
        s.subject.toLowerCase().includes(q) ||
        s.format.toLowerCase().includes(q) ||
        `level ${s.level}`.includes(q) ||
        `l${s.level}`.includes(q),
    );
  }

  // --- Level-specific climb & subjects ---

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

  addClimb(level: number): void {
    const subject = this.pick[level];
    if (!subject) return;
    this.grit.addToClimb(level, subject);
    this.pick[level] = '';
    this.toast.info(`Queued L${level} · ${subject}`);
  }

  moveClimb(level: number, row: GritProgress, dir: -1 | 1): void {
    this.grit.moveClimb(level, row, dir);
  }

  onDragOver(level: number, overId: string, event: DragEvent): void {
    event.preventDefault();
    const dragged = this.draggingId();
    if (dragged) this.grit.reorderClimb(level, dragged, overId);
  }

  hasCompletedInLevelClimb(level: number): boolean {
    return this.climb(level).some((r) => r.result !== 'none');
  }

  queueAllRemainingLevel(level: number): void {
    const lvl = this.levels.find((l) => l.level === level);
    if (!lvl) return;
    const count = this.available(lvl).length;
    if (count === 0) {
      this.toast.info(`All Level ${level} subjects are already queued or cleared`);
      return;
    }
    this.grit.queueAllRemaining(level);
    this.toast.show(`Added ${count} Level ${level} subjects to climb`, 'success');
  }

  clearCompletedLevel(level: number): void {
    this.grit.clearCompletedFromClimb(level);
    this.toast.info(`Cleared completed Level ${level} subjects from climb`);
  }

  // --- Common result & action methods ---

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

  setTarget(row: GritProgress, target: GritTarget): void {
    this.grit.setTarget(row.level, row.subject, target);
  }

  toggleClimbDone(level: number, row: GritProgress): void {
    if (row.result === 'none') {
      const targetResult: GritResult = row.target || 'gold';
      const def = findGritSubject(level, row.subject);
      this.grit.mark(level, row.subject, targetResult);
      this.progress.removeByTitle(row.subject);
      const miles = def ? milesForResult(def, targetResult) : 0;
      this.toast.show(`✓ ${this.labels[targetResult]} on L${level} ${row.subject} · +${miles} miles`, 'success');
    } else {
      this.grit.mark(level, row.subject, row.result);
      this.toast.info(`L${level} ${row.subject} reopened`);
    }
  }

  mark(level: number, subject: string, result: GritResult): void {
    const def = findGritSubject(level, subject);
    this.grit.mark(level, subject, result);
    const after = this.grit.resultOf(level, subject);
    if (after === 'none') {
      this.toast.info(`L${level} ${subject} is open again`);
      return;
    }
    this.progress.removeByTitle(subject);
    const miles = def ? milesForResult(def, after) : 0;
    const kind = after === 'retry' ? 'warning' : 'success';
    this.toast.show(`${this.labels[after]} on L${level} ${subject} · +${miles} miles`, kind);
  }

  reset(level: number, subject: string): void {
    this.grit.mark(level, subject, this.grit.resultOf(level, subject));
    this.toast.info(`L${level} ${subject} is open again`);
  }

  onDragStart(id: string): void {
    this.draggingId.set(id);
  }

  onDragEnd(): void {
    this.draggingId.set(null);
  }
}
