import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ThemeService } from '../../core/services/theme.service';
import { AcademicService } from '../../core/services/academic.service';
import {
  ACADEMIC_PRESETS,
  AcademicSubject,
  AcademicSub,
  PRIMARY_STAR_MIN,
  subjectProgress,
} from '../../core/data/academic-catalog';

type AcademicFilter = 'all' | 'primary' | 'others';

@Component({
  selector: 'app-academics-page',
  standalone: true,
  imports: [RouterLink, FormsModule, NgTemplateOutlet],
  templateUrl: './academics-page.component.html',
  styleUrl: './academics-page.component.css',
})
export class AcademicsPageComponent {
  readonly theme = inject(ThemeService);
  readonly academics = inject(AcademicService);
  readonly presets = ACADEMIC_PRESETS;
  readonly starMax = [1, 2, 3, 4, 5];

  readonly filter = signal<AcademicFilter>('all');
  readonly expanded = signal<string | null>(null);
  readonly draggingSubject = signal<string | null>(null);
  readonly draggingSub = signal<string | null>(null);
  readonly hideDone = signal(false);
  readonly query = signal('');
  newTrackName = '';
  newSubjectName = '';
  newSubjectStars = 3;
  renamingTrack = false;
  trackNameDraft = '';
  renamingSubjectId: string | null = null;
  subjectNameDraft = '';
  newUnitTitle: Record<string, string> = {};
  nestedTitle: Record<string, string> = {};

  readonly filters: Array<{ id: AcademicFilter; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'primary', label: 'Primary' },
    { id: 'others', label: 'Others' },
  ];

  readonly ringC = 2 * Math.PI * 18;

  readonly visible = computed(() => {
    const track = this.academics.activeTrack();
    if (!track) return { primary: [] as AcademicSubject[], others: [] as AcademicSubject[] };
    const q = this.query().trim().toLowerCase();
    const matches = (subject: AcademicSubject) =>
      !q ||
      subject.name.toLowerCase().includes(q) ||
      this.unitText(subject.subs).includes(q);
    const primary = track.subjects.filter((s) => s.stars >= PRIMARY_STAR_MIN && matches(s));
    const others = track.subjects.filter((s) => s.stars < PRIMARY_STAR_MIN && matches(s));
    const mode = this.filter();
    return {
      primary: mode === 'others' ? [] : primary,
      others: mode === 'primary' ? [] : others,
    };
  });

  toggleTheme(): void {
    this.theme.toggleLightDark();
  }

  ringOffset(): number {
    return this.ringC * (1 - this.academics.totals().percent / 100);
  }

  progress(subject: AcademicSubject) {
    return subjectProgress(subject);
  }

  toggleExpand(id: string): void {
    this.expanded.update((current) => (current === id ? null : id));
  }

  addSemester(): void {
    this.academics.addTrack(this.newTrackName || 'New semester');
    this.newTrackName = '';
  }

  startRenameTrack(name: string): void {
    this.renamingTrack = true;
    this.trackNameDraft = name;
  }

  saveTrackName(id: string): void {
    this.academics.renameTrack(id, this.trackNameDraft);
    this.renamingTrack = false;
  }

  startRenameSubject(id: string, name: string): void {
    this.renamingSubjectId = id;
    this.subjectNameDraft = name;
  }

  saveSubjectName(id: string): void {
    this.academics.renameSubject(id, this.subjectNameDraft);
    this.renamingSubjectId = null;
  }

  addSubject(): void {
    const track = this.academics.activeTrack();
    if (!track) return;
    this.academics.addSubject(track.id, this.newSubjectName, this.newSubjectStars);
    this.newSubjectName = '';
    this.newSubjectStars = 3;
  }

  addUnit(subjectId: string): void {
    const title = this.newUnitTitle[subjectId] || '';
    this.academics.addSub(subjectId, null, title);
    this.newUnitTitle[subjectId] = '';
  }

  addNested(subjectId: string, parentId: string): void {
    const key = `${subjectId}:${parentId}`;
    this.academics.addSub(subjectId, parentId, this.nestedTitle[key] || '');
    this.nestedTitle[key] = '';
  }

  visibleSubs(subs: AcademicSub[]): AcademicSub[] {
    if (!this.hideDone()) return subs || [];
    return (subs || []).filter((node) => !node.done);
  }

  onSubjectDragStart(id: string, event: DragEvent): void {
    this.draggingSubject.set(id);
    event.dataTransfer?.setData('text/plain', id);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  onSubjectDrop(overId: string): void {
    const track = this.academics.activeTrack();
    const dragged = this.draggingSubject();
    if (!track || !dragged) return;
    this.academics.reorderSubjects(track.id, dragged, overId);
    this.draggingSubject.set(null);
  }

  onSubDragStart(id: string, event: DragEvent): void {
    event.stopPropagation();
    this.draggingSub.set(id);
    event.dataTransfer?.setData('text/plain', id);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  onSubDrop(subjectId: string, parentId: string | null, overId: string, event: DragEvent): void {
    event.stopPropagation();
    event.preventDefault();
    const dragged = this.draggingSub();
    if (!dragged) return;
    this.academics.reorderSubs(subjectId, parentId, dragged, overId);
    this.draggingSub.set(null);
  }

  allowDrop(event: DragEvent): void {
    event.preventDefault();
  }

  private unitText(subs: AcademicSub[]): string {
    return (subs || [])
      .map((node) => `${node.title} ${this.unitText(node.subs || [])}`)
      .join(' ')
      .toLowerCase();
  }
}
