import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ThemeService } from '../../core/services/theme.service';
import { AcademicService } from '../../core/services/academic.service';
import { ProgressService } from '../../core/services/progress.service';
import { ToastService } from '../../core/services/toast.service';
import {
  ACADEMIC_PRESETS,
  AcademicPreset,
  AcademicSubject,
  AcademicTrack,
  PRIMARY_STAR_MIN,
  searchSubjectMatches,
  subjectProgress,
  summarizeTrack,
} from '../../core/data/academic-catalog';

export type SectionKind = 'primary' | 'others';
export type FilterTab = 'all' | 'primary' | 'others' | 'pending' | 'completed';

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
  private readonly progressService = inject(ProgressService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly presets = this.academics.allPacks;
  readonly starMax = [1, 2, 3, 4, 5];

  readonly selectedId = signal<string | null>(null);
  readonly expandedIds = signal<Set<string>>(new Set());
  readonly addingSection = signal<SectionKind | null>(null);
  readonly addingNestedId = signal<string | null>(null);
  readonly creating = signal(false);
  readonly creatingPack = signal(false);

  // Search & Filter
  readonly searchQuery = signal<string>('');
  readonly filterTab = signal<FilterTab>('all');

  // In-place edits
  readonly editingTrack = signal(false);
  readonly editingSubjectId = signal<string | null>(null);
  readonly editingUnitId = signal<string | null>(null);

  trackNameDraft = '';
  subjectNameDraft = '';
  unitTitleDraft = '';

  newTrackName = '';
  newSubjectName = '';
  newUnitTitle: Record<string, string> = {};
  nestedTitle = '';

  // Custom pack form
  packName = '';
  packBlurb = '';
  packBadge = 'Semester';
  packSubjectsRaw = '';

  readonly ringC = 2 * Math.PI * 18;

  readonly selected = computed(() => {
    const id = this.selectedId();
    if (!id) return null;
    return this.academics.tracks().find((track) => track.id === id) ?? null;
  });

  readonly summary = computed(() => {
    const track = this.selected();
    return track ? summarizeTrack(track) : null;
  });

  readonly filteredSubjects = computed(() => {
    const track = this.selected();
    if (!track) return { primary: [] as AcademicSubject[], others: [] as AcademicSubject[] };

    const query = this.searchQuery().trim();
    const tab = this.filterTab();

    const matchesFilter = (s: AcademicSubject) => {
      if (!searchSubjectMatches(s, query)) return false;
      const prog = subjectProgress(s);
      if (tab === 'primary') return s.stars >= PRIMARY_STAR_MIN;
      if (tab === 'others') return s.stars < PRIMARY_STAR_MIN;
      if (tab === 'pending') return prog.percent < 100;
      if (tab === 'completed') return prog.percent >= 100;
      return true;
    };

    const valid = track.subjects.filter(matchesFilter);
    return {
      primary: valid.filter((subject) => subject.stars >= PRIMARY_STAR_MIN),
      others: valid.filter((subject) => subject.stars < PRIMARY_STAR_MIN),
      totalMatches: valid.length,
    };
  });

  toggleTheme(): void {
    this.theme.toggleLightDark();
  }

  openSemester(id: string): void {
    this.selectedId.set(id);
    this.academics.setActive(id);
    this.expandedIds.set(new Set());
    this.addingSection.set(null);
    this.addingNestedId.set(null);
    this.searchQuery.set('');
    this.filterTab.set('all');
    this.editingTrack.set(false);
    this.editingSubjectId.set(null);
    this.editingUnitId.set(null);
  }

  backToSemesters(): void {
    this.selectedId.set(null);
    this.expandedIds.set(new Set());
    this.addingSection.set(null);
    this.searchQuery.set('');
  }

  cardSummary(track: AcademicTrack) {
    return summarizeTrack(track);
  }

  progress(subject: AcademicSubject) {
    return subjectProgress(subject);
  }

  ringOffset(): number {
    const pct = this.summary()?.percent ?? 0;
    return this.ringC * (1 - pct / 100);
  }

  isExpanded(id: string): boolean {
    return this.expandedIds().has(id);
  }

  toggleExpand(id: string): void {
    const current = new Set(this.expandedIds());
    if (current.has(id)) {
      current.delete(id);
    } else {
      current.add(id);
    }
    this.expandedIds.set(current);
    this.addingNestedId.set(null);
  }

  expandAll(): void {
    const track = this.selected();
    if (!track) return;
    const allIds = new Set(track.subjects.map((s) => s.id));
    this.expandedIds.set(allIds);
  }

  collapseAll(): void {
    this.expandedIds.set(new Set());
  }

  startEditTrack(currentName: string): void {
    this.trackNameDraft = currentName;
    this.editingTrack.set(true);
  }

  saveEditTrack(id: string): void {
    const name = this.trackNameDraft.trim();
    if (name) {
      this.academics.renameTrack(id, name);
      this.toast.success('Semester renamed');
    }
    this.editingTrack.set(false);
  }

  startEditSubject(subject: AcademicSubject, event: Event): void {
    event.stopPropagation();
    this.subjectNameDraft = subject.name;
    this.editingSubjectId.set(subject.id);
  }

  saveEditSubject(subjectId: string): void {
    const name = this.subjectNameDraft.trim();
    if (name) {
      this.academics.renameSubject(subjectId, name);
      this.toast.success('Subject updated');
    }
    this.editingSubjectId.set(null);
  }

  startEditUnit(unitId: string, currentTitle: string, event: Event): void {
    event.stopPropagation();
    this.unitTitleDraft = currentTitle;
    this.editingUnitId.set(unitId);
  }

  saveEditUnit(subjectId: string, unitId: string): void {
    const title = this.unitTitleDraft.trim();
    if (title) {
      this.academics.renameSub(subjectId, unitId, title);
    }
    this.editingUnitId.set(null);
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
    this.toast.success(`Created semester "${name}"`);
  }

  usePreset(id: string): void {
    const preset = this.presets().find((item) => item.id === id);
    if (!preset) return;
    this.academics.applyPreset(preset);
    const match = this.academics
      .tracks()
      .find((track) => track.name.toLowerCase() === preset.name.toLowerCase());
    if (match) this.openSemester(match.id);
    this.toast.success(`Loaded ${preset.name} syllabus`);
  }

  isCustomPack(packId: string): boolean {
    return this.academics.customPacks().some((p) => p.id === packId);
  }

  openCreatePack(): void {
    this.creatingPack.set(true);
    this.packName = '';
    this.packBlurb = '';
    this.packBadge = 'Semester';
    this.packSubjectsRaw = '';
  }

  saveNewPack(): void {
    const name = this.packName.trim();
    if (!name) return;
    const subjects = this.packSubjectsRaw
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((subName) => ({
        name: subName,
        stars: 4,
        units: [],
      }));

    this.academics.addCustomPack({
      id: 'pack-' + Date.now(),
      name,
      blurb: this.packBlurb.trim() || 'Custom course syllabus pack',
      badge: this.packBadge.trim() || 'Custom',
      subjects,
    });
    this.creatingPack.set(false);
  }

  removePack(packId: string, event?: Event): void {
    event?.stopPropagation();
    if (!confirm('Remove this custom pack?')) return;
    this.academics.removeCustomPack(packId);
  }

  saveCurrentTrackAsPack(): void {
    const track = this.selected();
    if (!track) return;
    this.academics.saveTrackAsPack(track.id);
    this.toast.success(`Saved "${track.name}" as a reusable pack! Visible beside Semester 5.`);
  }

  duplicateSemester(trackId: string, event?: Event): void {
    event?.stopPropagation();
    this.academics.duplicateTrack(trackId);
    this.toast.success('Semester duplicated');
  }

  removeSemester(id: string, event?: Event): void {
    event?.stopPropagation();
    if (!confirm('Are you sure you want to delete this semester and all its subjects?')) return;
    this.academics.removeTrack(id);
    if (this.selectedId() === id) this.backToSemesters();
    this.toast.info('Semester removed');
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
    this.toast.success(`Added "${this.newSubjectName}"`);
    this.newSubjectName = '';
    this.addingSection.set(null);
  }

  duplicateSubject(subjectId: string, event?: Event): void {
    event?.stopPropagation();
    this.academics.duplicateSubject(subjectId);
    this.toast.success('Subject duplicated');
  }

  removeSubject(subjectId: string, event?: Event): void {
    event?.stopPropagation();
    if (!confirm('Delete this subject and its units?')) return;
    this.academics.removeSubject(subjectId);
    this.toast.info('Subject deleted');
  }

  setStars(subjectId: string, stars: number, event?: Event): void {
    event?.stopPropagation();
    this.academics.setStars(subjectId, stars);
  }

  setAllUnitsDone(subject: AcademicSubject, done: boolean): void {
    this.academics.setAllSubs(subject.id, done);
    this.toast.info(done ? `All units in ${subject.name} marked complete!` : `Reset units in ${subject.name}`);
  }

  focusSubject(subject: AcademicSubject, unitTitle?: string, event?: Event): void {
    event?.stopPropagation();
    const title = unitTitle ? `${subject.name}: ${unitTitle}` : subject.name;
    const track = this.selected();
    this.progressService.add(title, track ? track.name : 'Academics', true);
    this.toast.success(`"${title}" sent to Current Focus!`);
  }

  focusAndGo(subject: AcademicSubject, event?: Event): void {
    event?.stopPropagation();
    this.focusSubject(subject);
    this.router.navigate(['/progress']);
  }

  addUnit(subjectId: string): void {
    const title = (this.newUnitTitle[subjectId] || '').trim();
    if (!title) return;
    this.academics.addSub(subjectId, null, title);
    this.newUnitTitle[subjectId] = '';
  }

  startNested(id: string, event: Event): void {
    event.stopPropagation();
    this.addingNestedId.set(id);
    this.nestedTitle = '';
  }

  addNested(subjectId: string, parentId: string): void {
    const title = this.nestedTitle.trim();
    if (!title) return;
    this.academics.addSub(subjectId, parentId, title);
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
