import { CategoryDef } from '../models';

export const CATEGORIES: CategoryDef[] = [
  { name: 'DSA', defaultType: 'productive', color: '#0d9488' },
  { name: 'Coding', defaultType: 'productive', color: '#0891b2' },
  { name: 'Development', defaultType: 'productive', color: '#0284c7' },
  { name: 'AI/ML', defaultType: 'productive', color: '#4f46e5' },
  { name: 'Data Science', defaultType: 'productive', color: '#6366f1' },
  { name: 'College', defaultType: 'productive', color: '#2563eb' },
  { name: 'Study', defaultType: 'productive', color: '#1d4ed8' },
  { name: 'Revision', defaultType: 'productive', color: '#4338ca' },
  { name: 'Projects', defaultType: 'productive', color: '#0f766e' },
  { name: 'Assignments', defaultType: 'productive', color: '#115e59' },
  { name: 'Interview Preparation', defaultType: 'productive', color: '#0e7490' },
  { name: 'Exercise', defaultType: 'productive', color: '#16a34a' },
  { name: 'Sleep', defaultType: 'sleep', color: '#64748b' },
  { name: 'Meals', defaultType: 'neutral', color: '#ca8a04' },
  { name: 'Travel', defaultType: 'neutral', color: '#a16207' },
  { name: 'Personal', defaultType: 'neutral', color: '#78716c' },
  { name: 'Entertainment', defaultType: 'unproductive', color: '#e11d48' },
  { name: 'YouTube', defaultType: 'unproductive', color: '#f43f5e' },
  { name: 'Social Media', defaultType: 'unproductive', color: '#db2777' },
  { name: 'Gaming', defaultType: 'unproductive', color: '#c026d3' },
  { name: 'Break', defaultType: 'neutral', color: '#94a3b8' },
  { name: 'Other', defaultType: 'neutral', color: '#6b7280' },
];

export const QUICK_ADD_PRESETS = [
  { label: 'DSA', category: 'DSA', type: 'productive' as const },
  { label: 'Coding', category: 'Coding', type: 'productive' as const },
  { label: 'Project', category: 'Projects', type: 'productive' as const },
  { label: 'Exercise', category: 'Exercise', type: 'productive' as const },
  { label: 'Break', category: 'Break', type: 'neutral' as const },
  { label: 'Sleep', category: 'Sleep', type: 'sleep' as const },
];

export const STORAGE_KEYS = {
  activities: 'pt.activities',
  goals: 'pt.goals',
  habits: 'pt.habits',
  settings: 'pt.settings',
  theme: 'pt.theme',
  auth: 'pt.auth',
  cloudMigrated: 'pt.cloudMigrated',
  grit: 'pt.grit',
  academics: 'pt.academics',
  progress: 'pt.progress',
} as const;

export const DEFAULT_SLEEP_TARGET_MINUTES = 8 * 60;

export const MINUTES_PER_DAY = 24 * 60;
