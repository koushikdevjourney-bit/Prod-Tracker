import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ThemeService } from '../core/services/theme.service';
import { SettingsService } from '../core/services/settings.service';
import { AuthService } from '../core/services/auth.service';
import { ActivityModalComponent } from '../shared/components/activity-modal/activity-modal.component';

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    ActivityModalComponent,
  ],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.css',
})
export class ShellComponent {
  readonly theme = inject(ThemeService);
  readonly settings = inject(SettingsService);
  readonly auth = inject(AuthService);

  readonly sidebarOpen = signal(false);

  readonly displayName = computed(
    () => this.auth.user()?.name || this.settings.settings().displayName || 'You'
  );

  readonly avatarLetter = computed(() => (this.displayName().charAt(0) || 'Y').toUpperCase());

  readonly accountHint = computed(() => this.auth.user()?.email || 'Signed in');

  readonly nav: NavItem[] = [
    { path: '/home', label: 'My Tracker', icon: '◈' },
    { path: '/dashboard', label: 'Dashboard', icon: '▦' },
    { path: '/timeline', label: 'Timeline', icon: '☰' },
    { path: '/activities', label: 'Activities', icon: '◎' },
    { path: '/goals', label: 'Goals', icon: '★' },
    { path: '/habits', label: 'Habits', icon: '↻' },
    { path: '/analytics', label: 'Analytics', icon: '◔' },
    { path: '/settings', label: 'Settings', icon: '⚙' },
  ];

  toggleSidebar(): void {
    this.sidebarOpen.update((v) => !v);
  }

  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  toggleTheme(): void {
    this.theme.toggleLightDark();
  }

  logout(): void {
    this.auth.logout();
  }

  @HostListener('window:resize')
  onResize(): void {
    if (window.innerWidth >= 960) this.sidebarOpen.set(false);
  }
}
