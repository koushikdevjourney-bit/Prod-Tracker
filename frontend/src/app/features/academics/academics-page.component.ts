import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ThemeService } from '../../core/services/theme.service';
import { AcademicService } from '../../core/services/academic.service';
import {
  ACADEMIC_PRESETS,
  AcademicSubject,
  AcademicTrack,
  PRIMARY_STAR_MIN,
  subjectProgress,
  summarizeTrack,
} from '../../core/data/academic-catalog';

type SectionKind = 'primary' | 'others';

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

  readonly selectedId = signal<string | null>(null);
  readonly expanded = signal<string | null>(null);
  readonly addingSection = signal<SectionKind | null>(null);
  readonly addingNestedId = signal<string | null>(null);
  readonly creating = signal(false);

  newTrackName = '';
  newSubjectName = '';
  newUnitTitle: Record<string, string> = {};
  nestedTitle = '';

  readonly selected = computed(() => {
    const id = this.selectedId();
    if (!id) return null;
    return this.academics.tracks().find((track) => track.id === id) ?? null;
  });

  readonly sections = computed(() => {
    const track = this.selected();
    if (!track) return { primary: [] as AcademicSubject[], others: [] as AcademicSubject[] };
    return {
      primary: track.subjects.filter((subject) => subject.stars >= PRIMARY_STAR_MIN),
      others: track.subjects.filter((subject) => subject.stars < PRIMARY_STAR_MIN),
    };
  });

  readonly summary = computed(() => {
    const track = this.selected();
    return track ? summarizeTrack(track) : null;
  });

  toggleTheme(): void {
    this.theme.toggleLightDark();
  }

  openSemester(id: string): void {
    this.selectedId.set(id);
    this.academics.setActive(id);
    this.expanded.set(null);
    this.addingSection.set(null);
    this.addingNestedId.set(null);
  }

  backToSemesters(): void {
    this.selectedId.set(null);
    this.expanded.set(null);
    this.addingSection.set(null);
  }

  cardSummary(track: AcademicTrack) {
    return summarizeTrack(track);
  }

  progress(subject: AcademicSubject) {
    return subjectProgress(subject);
  }

  toggleExpand(id: string): void {
    this.expanded.update((current) => (current === id ? null : id));
    this.addingNestedId.set(null);
  }

  startCreate(): void {
    this.creating.set(true);
  }

  addSemester(): void {
    const name = this.newTrackName.trim();
    if (!name) return;
    this.academics.addTrack(name);
    const created = this.academics.tracks().at(-1);
    this.newTrackName = '';
    this.creating.set(false);
    if (created) this.openSemester(created.id);
  }

  usePreset(id: string): void {
    const preset = this.presets.find((item) => item.id === id);
    if (!preset) return;
    this.academics.applyPreset(preset);
    const match = this.academics
      .tracks()
      .find((track) => track.name.toLowerCase() === preset.name.toLowerCase());
    if (match) this.openSemester(match.id);
  }

  removeSemester(id: string, event?: Event): void {
    event?.stopPropagation();
    if (!confirm('Delete this semester and its subjects?')) return;
    this.academics.removeTrack(id);
    if (this.selectedId() === id) this.backToSemesters();
  }

  startAddSubject(section: SectionKind): void {
    this.addingSection.set(section);
    this.newSubjectName = '';
  }

  addSubject(): void {
    const track = this.selected();
    const section = this.addingSection();
    if (!track || !section) return;
    this.academics.addSubject(track.id, this.newSubjectName, section === 'primary' ? 5 : 3);
    this.newSubjectName = '';
    this.addingSection.set(null);
  }

  addUnit(subjectId: string): void {
    this.academics.addSub(subjectId, null, this.newUnitTitle[subjectId] || '');
    this.newUnitTitle[subjectId] = '';
  }

  startNested(id: string, event: Event): void {
    event.stopPropagation();
    this.addingNestedId.set(id);
    this.nestedTitle = '';
  }

  addNested(subjectId: string, parentId: string): void {
    this.academics.addSub(subjectId, parentId, this.nestedTitle);
    this.nestedTitle = '';
    this.addingNestedId.set(null);
  }

  cancelAdd(): void {
    this.addingSection.set(null);
    this.addingNestedId.set(null);
    this.creating.set(false);
    this.newTrackName = '';
  }
}
