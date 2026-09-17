export interface AcademicSub {
  id: string;
  title: string;
  done: boolean;
  subs: AcademicSub[];
}

export interface AcademicSubject {
  id: string;
  name: string;
  stars: number;
  subs: AcademicSub[];
}

export interface AcademicTrack {
  id: string;
  name: string;
  subjects: AcademicSubject[];
}

export interface AcademicPreset {
  id: string;
  name: string;
  blurb: string;
  subjects: Array<{ name: string; stars: number; units?: string[] }>;
}

export const ACADEMIC_PRESETS: AcademicPreset[] = [
  {
    id: 'sem-5',
    name: 'Academics Sem-5',
    blurb: 'Semester 5 subjects with their units and topics',
    subjects: [
      { name: 'Computer Networks', stars: 5 },
      { name: 'PSE (Practical Software Engineering)', stars: 4, units: ['Linux', 'SDLC'] },
      { name: 'Machine Learning', stars: 4, units: ['Python with Data Science'] },
    ],
  },
  {
    id: 'sem-6',
    name: 'Academics Sem-6',
    blurb: 'Start a fresh sixth-semester tracker',
    subjects: [],
  },
];

export const PRIMARY_STAR_MIN = 4;

export function countUnits(subs: AcademicSub[]): { done: number; total: number } {
  let done = 0;
  let total = 0;
  const walk = (nodes: AcademicSub[]) => {
    for (const node of nodes) {
      total++;
      if (node.done) done++;
      walk(node.subs || []);
    }
  };
  walk(subs || []);
  return { done, total };
}

export function subjectProgress(subject: AcademicSubject): { done: number; total: number; percent: number } {
  const { done, total } = countUnits(subject.subs);
  return { done, total, percent: total ? Math.round((done / total) * 100) : 0 };
}

export function trackProgress(track: AcademicTrack): { done: number; total: number; percent: number } {
  let done = 0;
  let total = 0;
  for (const subject of track.subjects) {
    const u = countUnits(subject.subs);
    done += u.done;
    total += u.total;
  }
  return { done, total, percent: total ? Math.round((done / total) * 100) : 0 };
}
