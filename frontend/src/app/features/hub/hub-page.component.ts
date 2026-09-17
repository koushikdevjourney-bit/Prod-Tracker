import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme.service';

export interface HubSection {
  path: string;
  title: string;
  body: string;
  icon: 'progress' | 'roles' | 'academic' | 'grit';
}

export interface ProdSection {
  path: string;
  title: string;
  body: string;
}

@Component({
  selector: 'app-hub-page',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './hub-page.component.html',
  styleUrl: './hub-page.component.css',
})
export class HubPageComponent {
  readonly auth = inject(AuthService);
  readonly theme = inject(ThemeService);
  readonly prodOpen = signal(false);

  readonly prodSections: ProdSection[] = [
    { path: '/dashboard', title: 'Dashboard', body: 'Today’s metrics, sleep, and insights.' },
    { path: '/timeline', title: 'Timeline', body: 'Walk through the day block by block.' },
    { path: '/activities', title: 'Activities', body: 'Search, edit, and manage your log.' },
    { path: '/goals', title: 'Goals', body: 'Duration targets from real logged time.' },
    { path: '/habits', title: 'Habits', body: 'Check off habits and keep streaks.' },
    { path: '/analytics', title: 'Analytics', body: 'Daily, weekly, and monthly trends.' },
    { path: '/settings', title: 'Settings', body: 'Theme, sleep target, and account.' },
  ];

  readonly sections: HubSection[] = [
    {
      path: '/dashboard',
      title: 'Current progress tracker',
      body: 'Pick what you are focusing on now and set the order.',
      icon: 'progress',
    },
    {
      path: '/goals',
      title: 'Career roles',
      body: '1 role tracker · add packs, topics and skills.',
      icon: 'roles',
    },
    {
      path: '/activities',
      title: 'Academic trackers',
      body: '1 semester tracker · subjects and units.',
      icon: 'academic',
    },
    {
      path: '/grit',
      title: 'Grit tracker (NIAT)',
      body: 'Miles, levels and climb order for every subject.',
      icon: 'grit',
    },
  ];

  toggleProd(): void {
    this.prodOpen.update((open) => !open);
  }

  toggleTheme(): void {
    this.theme.toggleLightDark();
  }

  signOut(): void {
    this.auth.logout();
  }
}
