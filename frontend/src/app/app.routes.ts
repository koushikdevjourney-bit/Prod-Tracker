import { Routes } from '@angular/router';
import { ShellComponent } from './layout/shell.component';
import { authGuard, guestGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/login-page.component').then((m) => m.LoginPageComponent),
  },
  {
    path: 'register',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/register-page.component').then((m) => m.RegisterPageComponent),
  },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'timeline',
        loadComponent: () =>
          import('./features/timeline/timeline-page.component').then((m) => m.TimelinePageComponent),
      },
      {
        path: 'activities',
        loadComponent: () =>
          import('./features/activities/activities-page.component').then((m) => m.ActivitiesPageComponent),
      },
      {
        path: 'goals',
        loadComponent: () =>
          import('./features/goals/goals-page.component').then((m) => m.GoalsPageComponent),
      },
      {
        path: 'habits',
        loadComponent: () =>
          import('./features/habits/habits-page.component').then((m) => m.HabitsPageComponent),
      },
      {
        path: 'analytics',
        loadComponent: () =>
          import('./features/analytics/analytics-page.component').then((m) => m.AnalyticsPageComponent),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/settings/settings-page.component').then((m) => m.SettingsPageComponent),
      },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
