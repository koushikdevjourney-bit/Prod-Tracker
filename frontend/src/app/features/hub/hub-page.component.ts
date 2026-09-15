import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

export interface HubSection {
  path: string;
  label: string;
  title: string;
  body: string;
  icon: string;
}

@Component({
  selector: 'app-hub-page',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './hub-page.component.html',
  styleUrl: './hub-page.component.css',
})
export class HubPageComponent {
  readonly sections: HubSection[] = [
    {
      path: '/dashboard',
      label: 'Overview',
      title: 'Dashboard',
      body: 'Today’s metrics, timeline, sleep, goals, and insights in one place.',
      icon: '▦',
    },
    {
      path: '/timeline',
      label: 'Day flow',
      title: 'Timeline',
      body: 'Walk through every block of your day from wake-up to sleep.',
      icon: '☰',
    },
    {
      path: '/activities',
      label: 'Logbook',
      title: 'Activities',
      body: 'Search, filter, edit, duplicate, and manage the full activity history.',
      icon: '◎',
    },
    {
      path: '/goals',
      label: 'Targets',
      title: 'Goals',
      body: 'Daily duration targets that auto-update from what you actually logged.',
      icon: '★',
    },
    {
      path: '/habits',
      label: 'Consistency',
      title: 'Habits',
      body: 'Check off habits and keep streaks moving day after day.',
      icon: '↻',
    },
    {
      path: '/analytics',
      label: 'Trends',
      title: 'Analytics',
      body: 'Daily, weekly, and monthly productivity and category breakdowns.',
      icon: '◔',
    },
    {
      path: '/settings',
      label: 'Prefs',
      title: 'Settings',
      body: 'Theme, sleep target, sample data, and account controls.',
      icon: '⚙',
    },
  ];
}
