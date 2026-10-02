export type FocusPriority = 'urgent' | 'high' | 'medium' | 'low';
export type FocusStatus = 'pending' | 'in_progress' | 'completed';
export type FocusFilterTab = 'all' | 'active' | 'pinned' | 'due' | 'completed';
export type FocusSortOrder = 'priority-desc' | 'priority-asc' | 'default' | 'due-date' | 'title';

export interface FocusSubtask {
  id: string;
  title: string;
  done: boolean;
}

export interface FocusTodoItem {
  id: string;
  title: string;
  notes: string;
  status: FocusStatus;
  priority: FocusPriority;
  isPinned: boolean;
  category: string;
  dueDate: string;
  dueTime: string;
  estimatedMinutes: number;
  loggedMinutes: number;
  subtasks: FocusSubtask[];
  completedAt: string | null;
  createdAt: string;
  position: number;
}
