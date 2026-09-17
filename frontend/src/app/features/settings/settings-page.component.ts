import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SettingsService } from '../../core/services/settings.service';
import { ThemeService, ThemeMode } from '../../core/services/theme.service';
import { SampleDataService } from '../../core/services/sample-data.service';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../../core/services/auth.service';
import { DEFAULT_SLEEP_TARGET_MINUTES } from '../../core/constants/categories';

@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [FormsModule],
  template: `
    <section class="page">
      <header class="page-header">
        <p class="eyebrow">Settings</p>
        <h1>Preferences</h1>
        <p class="lede">Theme, sleep target, sample data, and account controls.</p>
      </header>

      <div class="settings-grid">
        <section class="panel form-grid">
          <h3>Profile</h3>
          @if (auth.user(); as user) {
            <p class="muted tiny">Signed in as <strong>{{ user.email }}</strong></p>
          }
          <label class="field">
            <span>Display name</span>
            <input class="input" [ngModel]="settings.settings().displayName" (ngModelChange)="onName($event)" />
          </label>
          <button type="button" class="btn btn--ghost btn--danger" (click)="logout()">Log out</button>
        </section>

        <section class="panel form-grid">
          <h3>Appearance</h3>
          <label class="field">
            <span>Theme</span>
            <select class="input" [ngModel]="theme.themeMode()" (ngModelChange)="onTheme($event)">
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="system">System</option>
            </select>
          </label>
        </section>

        <section class="panel form-grid">
          <h3>Sleep target</h3>
          <label class="field">
            <span>Hours per night</span>
            <input
              class="input"
              type="number"
              min="4"
              max="14"
              step="0.5"
              [ngModel]="sleepHours"
              (ngModelChange)="onSleep($event)"
            />
          </label>
          <p class="muted tiny">Used for deficit / surplus on the dashboard sleep card.</p>
        </section>

        <section class="panel form-grid">
          <h3>Demo data</h3>
          <p class="muted">Start empty by default. Optionally load one sample day — never shown as fake live stats.</p>
          <div class="form-actions">
            <button type="button" class="btn btn--secondary" (click)="loadSample()">Load sample day</button>
            <button type="button" class="btn btn--ghost btn--danger" (click)="clearData()">Clear all data</button>
          </div>
        </section>
      </div>
    </section>
  `,
  styles: `
    :host { display: block; }
    .page-header { margin-bottom: 1.25rem; }
    .page-header h1 { margin: 0.15rem 0 0.35rem; font-family: var(--font-display); letter-spacing: -0.03em; }
    .settings-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
    .form-actions { display: flex; flex-wrap: wrap; gap: 0.5rem; }
    @media (max-width: 800px) { .settings-grid { grid-template-columns: 1fr; } }
  `,
})
export class SettingsPageComponent {
  readonly settings = inject(SettingsService);
  readonly theme = inject(ThemeService);
  readonly auth = inject(AuthService);
  private readonly sample = inject(SampleDataService);
  private readonly toast = inject(ToastService);

  sleepHours =
    (this.settings.settings().sleepTargetMinutes || DEFAULT_SLEEP_TARGET_MINUTES) / 60;

  onName(name: string): void {
    this.settings.update({ displayName: name || 'You' });
  }

  onTheme(mode: ThemeMode): void {
    this.theme.setMode(mode);
    this.settings.update({ theme: mode });
  }

  onSleep(hours: number): void {
    this.sleepHours = hours;
    this.settings.setSleepTargetHours(Number(hours));
  }

  loadSample(): void {
    this.sample.loadSampleDay();
    this.toast.success('Sample day loaded');
  }

  clearData(): void {
    if (!confirm('Clear all activities, goals, habits, and grit progress from your account?')) return;
    this.sample.clearAllData();
  }

  logout(): void {
    this.auth.logout();
  }
}
