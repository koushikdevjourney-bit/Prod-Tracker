export type AiProvider = 'gemini' | 'openai' | 'groq' | 'anthropic' | 'custom';

export type DateRangeContext = 'today' | 'last7days' | 'last30days' | 'all';

export interface AiSettings {
  provider: AiProvider;
  apiKey?: string;
  model?: string;
  customEndpoint?: string;
  systemPromptModifier?: string;
}

export interface AiMetricHighlight {
  label: string;
  value: string;
  icon: string;
  trend?: 'up' | 'down' | 'neutral';
  tone?: 'positive' | 'warning' | 'neutral' | 'accent';
}

export interface AiMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  reportType?: 'weekly' | 'daily' | 'monthly' | 'custom' | 'goals' | 'academics' | 'burnout';
  metrics?: AiMetricHighlight[];
  dateRangeContext?: DateRangeContext;
  isAnalyzing?: boolean;
}

export interface AggregatedLogsContext {
  range: DateRangeContext;
  rangeLabel: string;
  totalDurationMinutes: number;
  productiveMinutes: number;
  neutralMinutes: number;
  unproductiveMinutes: number;
  sleepMinutes: number;
  productivityScore: number;
  activitiesCount: number;
  topCategories: Array<{ name: string; minutes: number; percent: number; color?: string }>;
  unproductiveItems: Array<{ name: string; category: string; minutes: number }>;
  recentNotes: string[];
  activeGoals: Array<{ name: string; targetMinutes: number; period: string }>;
  activeHabits: Array<{ name: string; streak: number; targetDaysPerWeek: number }>;
  academicSubjects: Array<{ name: string; semester: string; priority: number }>;
  activeFocusTasks: Array<{ title: string; completed: boolean; priority: string }>;
}
