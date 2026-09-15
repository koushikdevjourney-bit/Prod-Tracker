import { Injectable, inject } from '@angular/core';
import { Activity, Goal, Habit } from '../models';
import { ActivityService } from './activity.service';
import { GoalService } from './goal.service';
import { HabitService } from './habit.service';
import { addDays, createId, todayKey } from '../utils/stats.utils';

/** Optional demo seed — only via Settings, never auto-faked on empty dashboard. */
@Injectable({ providedIn: 'root' })
export class SampleDataService {
  private readonly activities = inject(ActivityService);
  private readonly goals = inject(GoalService);
  private readonly habits = inject(HabitService);

  loadSampleDay(): void {
    const today = todayKey();
    const now = new Date().toISOString();

    const sample: Activity[] = [
      {
        _id: createId(),
        name: 'Night sleep',
        category: 'Sleep',
        date: addDays(today, -1),
        startTime: '23:00',
        endTime: '07:00',
        endDate: today,
        durationMinutes: 480,
        type: 'sleep',
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: createId(),
        name: 'Morning DSA',
        category: 'DSA',
        date: today,
        startTime: '08:00',
        endTime: '10:00',
        durationMinutes: 120,
        type: 'productive',
        notes: 'Arrays & hashing',
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: createId(),
        name: 'Deep work — project',
        category: 'Projects',
        date: today,
        startTime: '10:30',
        endTime: '13:00',
        durationMinutes: 150,
        type: 'productive',
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: createId(),
        name: 'Lunch',
        category: 'Meals',
        date: today,
        startTime: '13:00',
        endTime: '13:45',
        durationMinutes: 45,
        type: 'neutral',
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: createId(),
        name: 'Coding session',
        category: 'Coding',
        date: today,
        startTime: '14:00',
        endTime: '17:00',
        durationMinutes: 180,
        type: 'productive',
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: createId(),
        name: 'Walk',
        category: 'Exercise',
        date: today,
        startTime: '17:30',
        endTime: '18:15',
        durationMinutes: 45,
        type: 'productive',
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: createId(),
        name: 'Break scroll',
        category: 'Social Media',
        date: today,
        startTime: '21:00',
        endTime: '21:30',
        durationMinutes: 30,
        type: 'unproductive',
        createdAt: now,
        updatedAt: now,
      },
    ];

    const existing = this.activities.activities();
    this.activities.replaceAll([...existing, ...sample]);

    if (this.goals.goals().length === 0) {
      const g: Goal = {
        _id: createId(),
        name: 'Deep work',
        category: undefined,
        targetMinutes: 360,
        date: today,
        period: 'daily',
        createdAt: now,
        updatedAt: now,
      };
      this.goals.replaceAll([g]);
    }

    if (this.habits.habits().length === 0) {
      const h: Habit[] = [
        {
          _id: createId(),
          name: 'Exercise',
          targetDaysPerWeek: 5,
          completedDates: [today],
          color: '#16a34a',
          createdAt: now,
          updatedAt: now,
        },
        {
          _id: createId(),
          name: 'Read 20 pages',
          targetDaysPerWeek: 7,
          completedDates: [],
          color: '#0d9488',
          createdAt: now,
          updatedAt: now,
        },
      ];
      this.habits.replaceAll(h);
    }
  }

  clearAllData(): void {
    this.activities.clearAll();
    this.goals.clearAll();
    this.habits.clearAll();
  }
}
