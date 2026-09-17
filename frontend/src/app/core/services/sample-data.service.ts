import { Injectable, inject } from '@angular/core';
import { ActivityService } from './activity.service';
import { GoalService } from './goal.service';
import { HabitService } from './habit.service';
import { DataSyncService } from './data-sync.service';
import { addDays, todayKey } from '../utils/stats.utils';

/** Optional demo seed — only via Settings, never auto-faked on empty dashboard. */
@Injectable({ providedIn: 'root' })
export class SampleDataService {
  private readonly activities = inject(ActivityService);
  private readonly goals = inject(GoalService);
  private readonly habits = inject(HabitService);
  private readonly sync = inject(DataSyncService);

  loadSampleDay(): void {
    const today = todayKey();

    this.activities.create({
      name: 'Night sleep',
      category: 'Sleep',
      date: addDays(today, -1),
      startTime: '23:00',
      endTime: '07:00',
      type: 'sleep',
    });
    this.activities.create({
      name: 'Morning DSA',
      category: 'DSA',
      date: today,
      startTime: '08:00',
      endTime: '10:00',
      type: 'productive',
      notes: 'Arrays & hashing',
    });
    this.activities.create({
      name: 'Deep work — project',
      category: 'Projects',
      date: today,
      startTime: '10:30',
      endTime: '13:00',
      type: 'productive',
    });
    this.activities.create({
      name: 'Lunch',
      category: 'Meals',
      date: today,
      startTime: '13:00',
      endTime: '13:45',
      type: 'neutral',
    });
    this.activities.create({
      name: 'Coding session',
      category: 'Coding',
      date: today,
      startTime: '14:00',
      endTime: '17:00',
      type: 'productive',
    });
    this.activities.create({
      name: 'Walk',
      category: 'Exercise',
      date: today,
      startTime: '17:30',
      endTime: '18:15',
      type: 'productive',
    });
    this.activities.create({
      name: 'Break scroll',
      category: 'Social Media',
      date: today,
      startTime: '21:00',
      endTime: '21:30',
      type: 'unproductive',
    });

    if (this.goals.goals().length === 0) {
      this.goals.create({
        name: 'Deep work',
        targetMinutes: 360,
        date: today,
        period: 'daily',
      });
    }

    if (this.habits.habits().length === 0) {
      this.habits.create({
        name: 'Exercise',
        targetDaysPerWeek: 5,
        color: '#16a34a',
      });
      this.habits.create({
        name: 'Read 20 pages',
        targetDaysPerWeek: 7,
        color: '#0d9488',
      });
    }
  }

  clearAllData(): void {
    this.sync.clearAll();
  }
}
