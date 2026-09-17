import { Injectable, computed, inject, signal } from '@angular/core';
import { STORAGE_KEYS } from '../constants/categories';
import {
  ACADEMIC_PRESETS,
  AcademicPreset,
  AcademicSub,
  AcademicSubject,
  AcademicTrack,
  PRIMARY_STAR_MIN,
  trackProgress,
} from '../data/academic-catalog';
import { LocalStoreService } from './local-store.service';
import { TrackerApiService } from './tracker-api.service';
import { ToastService } from './toast.service';
import { apiErrorMessage } from '../utils/api-error';
import { createId } from '../utils/stats.utils';

function cloneSubs(subs: AcademicSub[] = []): AcademicSub[] {
  return subs.map((node) => ({
    id: node.id,
    title: node.title,
    done: Boolean(node.done),
    subs: cloneSubs(node.subs),
  }));
}

function cloneTracks(tracks: AcademicTrack[] = []): AcademicTrack[] {
  return tracks.map((track) => ({
    id: track.id,
    name: track.name,
    subjects: (track.subjects || []).map((subject) => ({
      id: subject.id,
      name: subject.name,
      stars: subject.stars,
      subs: cloneSubs(subject.subs),
    })),
  }));
}

function moveById<T extends { id: string }>(list: T[], draggedId: string, overId: string): T[] {
  const from = list.findIndex((item) => item.id === draggedId);
  const to = list.findIndex((item) => item.id === overId);
  if (from < 0 || to < 0 || from === to) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function toggleSubDeep(subs: AcademicSub[], id: string): AcademicSub[] {
  return subs.map((node) =>
    node.id === id
      ? { ...node, done: !node.done }
      : { ...node, subs: toggleSubDeep(node.subs || [], id) },
  );
}

function removeSubDeep(subs: AcademicSub[], id: string): AcademicSub[] {
  return subs
    .filter((node) => node.id !== id)
    .map((node) => ({ ...node, subs: removeSubDeep(node.subs || [], id) }));
}

function addChildDeep(subs: AcademicSub[], parentId: string, child: AcademicSub): AcademicSub[] {
  return subs.map((node) =>
    node.id === parentId
      ? { ...node, subs: [...(node.subs || []), child] }
      : { ...node, subs: addChildDeep(node.subs || [], parentId, child) },
  );
}

function renameSubDeep(subs: AcademicSub[], id: string, title: string): AcademicSub[] {
  return subs.map((node) =>
    node.id === id
      ? { ...node, title }
      : { ...node, subs: renameSubDeep(node.subs || [], id, title) },
  );
}

function reorderSubsDeep(
  subs: AcademicSub[],
  parentId: string | null,
  draggedId: string,
  overId: string,
): AcademicSub[] {
  if (parentId === null) return moveById(subs, draggedId, overId);
  return subs.map((node) =>
    node.id === parentId
      ? { ...node, subs: moveById(node.subs || [], draggedId, overId) }
      : { ...node, subs: reorderSubsDeep(node.subs || [], parentId, draggedId, overId) },
  );
}

function makeSub(title: string): AcademicSub {
  return { id: createId(), title, done: false, subs: [] };
}

@Injectable({ providedIn: 'root' })
export class AcademicService {
  private readonly store = inject(LocalStoreService);
  private readonly api = inject(TrackerApiService);
  private readonly toast = inject(ToastService);
  private readonly _tracks = signal<AcademicTrack[]>(
    this.store.get<AcademicTrack[]>(STORAGE_KEYS.academics, []),
  );
  private persistTimer: ReturnType<typeof setTimeout> | null = null;

  readonly tracks = this._tracks.asReadonly();
  readonly activeId = signal<string | null>(null);

  readonly activeTrack = computed(() => {
    const list = this._tracks();
    if (!list.length) return null;
    return list.find((track) => track.id === this.activeId()) ?? list[0];
  });

  readonly totals = computed(() => {
    const track = this.activeTrack();
    if (!track) return { done: 0, total: 0, percent: 0, subjects: 0, primary: 0, others: 0 };
    const progress = trackProgress(track);
    const primary = track.subjects.filter((s) => s.stars >= PRIMARY_STAR_MIN).length;
    return {
      ...progress,
      subjects: track.subjects.length,
      primary,
      others: track.subjects.length - primary,
    };
  });

  hydrate(tracks: AcademicTrack[]): void {
    const next = cloneTracks(tracks ?? []);
    this._tracks.set(next);
    this.store.set(STORAGE_KEYS.academics, next);
    if (!next.some((track) => track.id === this.activeId())) {
      this.activeId.set(next[0]?.id ?? null);
    }
  }

  resetLocal(): void {
    this._tracks.set([]);
    this.activeId.set(null);
    this.store.remove(STORAGE_KEYS.academics);
  }

  setActive(id: string): void {
    this.activeId.set(id);
  }

  applyPreset(preset: AcademicPreset): void {
    const existing = this._tracks().find(
      (track) => track.name.toLowerCase() === preset.name.toLowerCase(),
    );
    if (existing) {
      this.activeId.set(existing.id);
      this.toast.info(`${preset.name} is already on your account`);
      return;
    }
    const track: AcademicTrack = {
      id: createId(),
      name: preset.name,
      subjects: preset.subjects.map((subject) => ({
        id: createId(),
        name: subject.name,
        stars: subject.stars,
        subs: (subject.units || []).map((title) => makeSub(title)),
      })),
    };
    this._tracks.update((list) => [...list, track]);
    this.activeId.set(track.id);
    this.persist();
  }

  addTrack(name: string): void {
    const trimmed = name.trim();
    if (!trimmed) return;
    const track: AcademicTrack = { id: createId(), name: trimmed, subjects: [] };
    this._tracks.update((list) => [...list, track]);
    this.activeId.set(track.id);
    this.persist();
  }

  renameTrack(id: string, name: string): void {
    const trimmed = name.trim();
    if (!trimmed) return;
    this.patchTracks((list) =>
      list.map((track) => (track.id === id ? { ...track, name: trimmed } : track)),
    );
  }

  removeTrack(id: string): void {
    this.patchTracks((list) => list.filter((track) => track.id !== id));
    if (this.activeId() === id) {
      this.activeId.set(this._tracks()[0]?.id ?? null);
    }
  }

  addSubject(trackId: string, name: string, stars = 3): void {
    const trimmed = name.trim();
    if (!trimmed) return;
    const subject: AcademicSubject = {
      id: createId(),
      name: trimmed,
      stars: Math.min(5, Math.max(1, stars)),
      subs: [],
    };
    this.patchTracks((list) =>
      list.map((track) =>
        track.id === trackId ? { ...track, subjects: [...track.subjects, subject] } : track,
      ),
    );
  }

  renameSubject(subjectId: string, name: string): void {
    const trimmed = name.trim();
    if (!trimmed) return;
    this.patchSubject(subjectId, (subject) => ({ ...subject, name: trimmed }));
  }

  setStars(subjectId: string, stars: number): void {
    this.patchSubject(subjectId, (subject) => ({
      ...subject,
      stars: Math.min(5, Math.max(1, stars)),
    }));
  }

  removeSubject(subjectId: string): void {
    this.patchTracks((list) =>
      list.map((track) => ({
        ...track,
        subjects: track.subjects.filter((subject) => subject.id !== subjectId),
      })),
    );
  }

  duplicateSubject(subjectId: string): void {
    this.patchTracks((list) =>
      list.map((track) => {
        const index = track.subjects.findIndex((subject) => subject.id === subjectId);
        if (index < 0) return track;
        const source = track.subjects[index];
        const copy: AcademicSubject = {
          id: createId(),
          name: `${source.name} copy`,
          stars: source.stars,
          subs: cloneSubs(source.subs),
        };
        const subjects = [...track.subjects];
        subjects.splice(index + 1, 0, copy);
        return { ...track, subjects };
      }),
    );
  }

  reorderSubjects(trackId: string, draggedId: string, overId: string): void {
    this.patchTracks((list) =>
      list.map((track) =>
        track.id === trackId
          ? { ...track, subjects: moveById(track.subjects, draggedId, overId) }
          : track,
      ),
    );
  }

  addSub(subjectId: string, parentId: string | null, title: string): void {
    const trimmed = title.trim();
    if (!trimmed) return;
    const child = makeSub(trimmed);
    this.patchSubject(subjectId, (subject) => ({
      ...subject,
      subs:
        parentId === null
          ? [...(subject.subs || []), child]
          : addChildDeep(subject.subs || [], parentId, child),
    }));
  }

  toggleSub(subjectId: string, subId: string): void {
    this.patchSubject(subjectId, (subject) => ({
      ...subject,
      subs: toggleSubDeep(subject.subs || [], subId),
    }));
  }

  renameSub(subjectId: string, subId: string, title: string): void {
    const trimmed = title.trim();
    if (!trimmed) return;
    this.patchSubject(subjectId, (subject) => ({
      ...subject,
      subs: renameSubDeep(subject.subs || [], subId, trimmed),
    }));
  }

  removeSub(subjectId: string, subId: string): void {
    this.patchSubject(subjectId, (subject) => ({
      ...subject,
      subs: removeSubDeep(subject.subs || [], subId),
    }));
  }

  reorderSubs(subjectId: string, parentId: string | null, draggedId: string, overId: string): void {
    this.patchSubject(subjectId, (subject) => ({
      ...subject,
      subs: reorderSubsDeep(subject.subs || [], parentId, draggedId, overId),
    }));
  }

  private patchSubject(subjectId: string, mapper: (subject: AcademicSubject) => AcademicSubject): void {
    this.patchTracks((list) =>
      list.map((track) => ({
        ...track,
        subjects: track.subjects.map((subject) =>
          subject.id === subjectId ? mapper(subject) : subject,
        ),
      })),
    );
  }

  private patchTracks(mapper: (list: AcademicTrack[]) => AcademicTrack[]): void {
    this._tracks.update((list) => mapper(cloneTracks(list)));
    this.persist();
  }

  private persist(): void {
    this.store.set(STORAGE_KEYS.academics, this._tracks());
    if (!this.hasSession()) return;
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      this.api.saveAcademics(this._tracks()).subscribe({
        error: (err) => this.toast.error(apiErrorMessage(err, 'Could not save academic tracker')),
      });
    }, 400);
  }

  private hasSession(): boolean {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.auth);
      if (!raw) return false;
      return Boolean(JSON.parse(raw)?.token);
    } catch {
      return false;
    }
  }
}

export { ACADEMIC_PRESETS };
