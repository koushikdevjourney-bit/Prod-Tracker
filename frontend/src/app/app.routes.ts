import { Routes } from '@angular/router';
import { ShellComponent } from './layout/shell.component';
import { authGuard, guestGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/landing/landing-page.component').then((m) => m.LandingPageComponent),
  },
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
    path: 'home',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/hub/hub-page.component').then((m) => m.HubPageComponent),
  },
  {
    path: 'grit',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/grit/grit-page.component').then((m) => m.GritPageComponent),
  },
  {
    path: 'academics',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/academics/academics-page.component').then((m) => m.AcademicsPageComponent),
  },
  {
    path: 'progress',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/progress/progress-page.component').then((m) => m.ProgressPageComponent),
  },
  {
    path: 'focused-todo',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/focus-todo/focus-todo-page.component').then((m) => m.FocusTodoPageComponent),
  },
  {
    path: 'focus-todo',
    redirectTo: 'focused-todo',
    pathMatch: 'full',
  },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'timeline',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
      {
        path: 'activities',
        loadComponent: () =>
          import('./features/activities/activities-page.component').then((m) => m.ActivitiesPageComponent),
      },
      {
        path: 'goals',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
      {
        path: 'habits',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
      {
        path: 'analytics',
        loadComponent: () =>
          import('./features/analytics/analytics-page.component').then((m) => m.AnalyticsPageComponent),
      },
      {
        path: 'ai-agent',
        loadComponent: () =>
          import('./features/ai-agent/ai-agent-page.component').then((m) => m.AiAgentPageComponent),
      },
      {
        path: 'ai',
        redirectTo: 'ai-agent',
        pathMatch: 'full',
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/settings/settings-page.component').then((m) => m.SettingsPageComponent),
      },
    ],
  },
  { path: '**', redirectTo: 'home' },
];
