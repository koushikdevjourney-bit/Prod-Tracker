export interface ProgressItem {
  id: string;
  title: string;
  note: string;
  percent: number;
  done: boolean;
  position: number;
  source: string;
  due: string;
  minutes: number;
}

export interface ProgressState {
  intention: string;
  items: ProgressItem[];
  focusMinutesToday: number;
  focusDate: string;
}

export const EMPTY_PROGRESS: ProgressState = {
  intention: '',
  items: [],
  focusMinutesToday: 0,
  focusDate: '',
};

export const FOCUS_PRESETS = ['DSA', 'Coding', 'Project', 'Interview prep', 'Revision'];

export const FOCUS_LENGTHS = [15, 25, 50] as const;

export function overallPercent(items: ProgressItem[]): number {
  if (!items.length) return 0;
  const sum = items.reduce((acc, item) => acc + (item.done ? 100 : item.percent), 0);
  return Math.round(sum / items.length);
}

export function dueLabel(due: string, today: string): 'today' | 'overdue' | 'soon' | '' {
  if (!due) return '';
  if (due === today) return 'today';
  if (due < today) return 'overdue';
  return 'soon';
}
