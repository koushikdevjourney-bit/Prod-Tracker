import { CategoryDef } from '../models';

export const CATEGORIES: CategoryDef[] = [
  { name: 'DSA', defaultType: 'productive', color: '#0d9488' },
  { name: 'Development', defaultType: 'productive', color: '#0284c7' },
  { name: 'AI/ML', defaultType: 'productive', color: '#6366f1' },
  { name: 'Internship', defaultType: 'productive', color: '#2563eb' },
  { name: 'Interview / GRIT Prep', defaultType: 'productive', color: '#0e7490' },
  { name: 'Freshen Up / Personal Care', defaultType: 'neutral', color: '#78716c' },
  { name: 'Breakfast / Lunch / Dinner', defaultType: 'neutral', color: '#ca8a04' },
  { name: 'Travel', defaultType: 'neutral', color: '#a16207' },
  { name: 'Sleep', defaultType: 'sleep', color: '#64748b' },
  { name: 'Break', defaultType: 'neutral', color: '#94a3b8' },
  { name: 'Social Media', defaultType: 'unproductive', color: '#db2777' },
];

export const QUICK_ADD_PRESETS = [
  { label: 'DSA', category: 'DSA', type: 'productive' as const },
  { label: 'Development', category: 'Development', type: 'productive' as const },
  { label: 'AI/ML', category: 'AI/ML', type: 'productive' as const },
  { label: 'GRIT Prep', category: 'Interview / GRIT Prep', type: 'productive' as const },
  { label: 'Meals', category: 'Breakfast / Lunch / Dinner', type: 'neutral' as const },
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
  academicPacks: 'pt.academic_packs',
  progress: 'pt.progress',
  focusTodos: 'pt.focusTodos',
  aiSettings: 'pt.aiSettings',
  aiChatHistory: 'pt.aiChatHistory',
  aiChatSessions: 'pt.aiChatSessions',
} as const;

export const DEFAULT_SLEEP_TARGET_MINUTES = 8 * 60;

export const MINUTES_PER_DAY = 24 * 60;
