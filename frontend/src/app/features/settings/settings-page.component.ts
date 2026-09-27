import { Component, inject, signal } from '@angular/core';
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
        <p class="lede">Theme, sleep target, hourly email reminders, and account controls.</p>
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
          <h3>Hourly Email Reminders</h3>
          <p class="muted tiny">Get a check-in email every hour to log your activity and protect your streak.</p>
          
          <label class="check-field">
            <input
              type="checkbox"
              [ngModel]="settings.settings().hourlyEmailReminders !== false"
              (ngModelChange)="onToggleReminders($event)"
            />
            <span>Enable hourly email reminders</span>
          </label>

          <label class="field">
            <span>Delivery Email</span>
            <input
              class="input"
              type="email"
              [ngModel]="settings.settings().reminderEmail || 'koushiksai242@gmail.com'"
              (ngModelChange)="onReminderEmail($event)"
              placeholder="koushiksai242@gmail.com"
            />
          </label>

          <div class="hours-row">
            <label class="field">
              <span>Active from</span>
              <select class="input" [ngModel]="settings.settings().reminderStartHour ?? 8" (ngModelChange)="onStartHour($event)">
                @for (h of hours; track h) {
                  <option [value]="h">{{ formatHour(h) }}</option>
                }
              </select>
            </label>
            <label class="field">
              <span>Until</span>
              <select class="input" [ngModel]="settings.settings().reminderEndHour ?? 23" (ngModelChange)="onEndHour($event)">
                @for (h of hours; track h) {
                  <option [value]="h">{{ formatHour(h) }}</option>
                }
              </select>
            </label>
          </div>

          <div class="form-actions">
            <button
              type="button"
              class="btn btn--secondary"
              (click)="sendTestEmail()"
              [disabled]="sendingTest()"
            >
              {{ sendingTest() ? 'Sending...' : '⚡ Send Test Email' }}
            </button>
          </div>
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
    .form-actions { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.25rem; }
    .check-field { display: flex; align-items: center; gap: 0.5rem; font-weight: 600; font-size: 0.88rem; cursor: pointer; }
    .check-field input[type="checkbox"] { accent-color: var(--accent); width: 1.05rem; height: 1.05rem; }
    .hours-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.65rem; }
    @media (max-width: 800px) { .settings-grid { grid-template-columns: 1fr; } }
  `,
})
export class SettingsPageComponent {
  readonly settings = inject(SettingsService);
  readonly theme = inject(ThemeService);
  readonly auth = inject(AuthService);
  private readonly sample = inject(SampleDataService);
  private readonly toast = inject(ToastService);

  readonly sendingTest = signal(false);
  readonly hours = Array.from({ length: 24 }, (_, i) => i);

  sleepHours =
    (this.settings.settings().sleepTargetMinutes || DEFAULT_SLEEP_TARGET_MINUTES) / 60;

  formatHour(h: number): string {
    const ampm = h >= 12 ? 'PM' : 'AM';
    const display = h % 12 || 12;
    return `${display}:00 ${ampm}`;
  }

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

  onToggleReminders(enabled: boolean): void {
    this.settings.update({ hourlyEmailReminders: enabled });
    this.toast.info(enabled ? 'Hourly reminders enabled' : 'Hourly reminders paused');
  }

  onReminderEmail(email: string): void {
    this.settings.update({ reminderEmail: email.trim().toLowerCase() });
  }

  onStartHour(h: string | number): void {
    this.settings.update({ reminderStartHour: Number(h) });
  }

  onEndHour(h: string | number): void {
    this.settings.update({ reminderEndHour: Number(h) });
  }

  sendTestEmail(): void {
    const email = this.settings.settings().reminderEmail || 'koushiksai242@gmail.com';
    const name = this.settings.settings().displayName || 'Koushik';
    this.sendingTest.set(true);

    this.settings.sendTestReminder(email, name).subscribe({
      next: () => {
        this.sendingTest.set(false);
        this.toast.success(`Test reminder email sent to ${email}!`);
      },
      error: (err) => {
        this.sendingTest.set(false);
        this.toast.error(err?.error?.message || err?.message || 'Could not send test email');
      },
    });
  }

  loadSample(): void {
    this.sample.loadSampleDay();
    this.toast.success('Sample day loaded');
  }

  clearData(): void {
    if (!confirm('Clear all activities, goals, habits, grit, academic, and current progress from your account?')) return;
    this.sample.clearAllData();
  }

  logout(): void {
    this.auth.logout();
  }
}
