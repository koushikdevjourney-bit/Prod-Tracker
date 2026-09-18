import { Injectable, signal } from '@angular/core';
import { Activity, ActivityType } from '../../../core/models';

export interface ActivityModalState {
  open: boolean;
  mode: 'create' | 'edit';
  activity?: Activity;
  defaults?: Partial<{
    name: string;
    category: string;
    date: string;
    startTime: string;
    endTime: string;
    type: ActivityType;
    continueFrom: string;
  }>;
}

@Injectable({ providedIn: 'root' })
export class ActivityModalService {
  private readonly _state = signal<ActivityModalState>({ open: false, mode: 'create' });
  readonly state = this._state.asReadonly();

  openCreate(defaults?: ActivityModalState['defaults']): void {
    this._state.set({ open: true, mode: 'create', defaults });
  }

  openEdit(activity: Activity): void {
    this._state.set({ open: true, mode: 'edit', activity });
  }

  close(): void {
    this._state.set({ open: false, mode: 'create' });
  }
}
