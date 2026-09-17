import { Injectable, inject, signal } from '@angular/core';
import { AppSettings } from '../models';
import { DEFAULT_SLEEP_TARGET_MINUTES, STORAGE_KEYS } from '../constants/categories';
import { LocalStoreService } from './local-store.service';
import { TrackerApiService } from './tracker-api.service';
import { ToastService } from './toast.service';
import { apiErrorMessage } from '../utils/api-error';

const DEFAULTS: AppSettings = {
  sleepTargetMinutes: DEFAULT_SLEEP_TARGET_MINUTES,
  displayName: 'You',
  theme: 'system',
};

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly store = inject(LocalStoreService);
  private readonly api = inject(TrackerApiService);
  private readonly toast = inject(ToastService);
  private readonly _settings = signal<AppSettings>({
    ...DEFAULTS,
    ...this.store.get<Partial<AppSettings>>(STORAGE_KEYS.settings, {}),
  });

  readonly settings = this._settings.asReadonly();

  hydrate(settings: Partial<AppSettings> | null | undefined): void {
    const next = { ...DEFAULTS, ...settings };
    this._settings.set(next);
    this.store.set(STORAGE_KEYS.settings, next);
  }

  resetLocal(): void {
    this._settings.set(DEFAULTS);
    this.store.remove(STORAGE_KEYS.settings);
  }

  update(partial: Partial<AppSettings>, options: { persist?: boolean } = {}): void {
    const persist = options.persist !== false;
    this._settings.update((s) => {
      const next = { ...s, ...partial };
      this.store.set(STORAGE_KEYS.settings, next);
      return next;
    });
    if (persist && this.hasSession()) {
      this.api.updateSettings(this._settings()).subscribe({
        next: (saved) => {
          this._settings.set({ ...DEFAULTS, ...saved });
          this.store.set(STORAGE_KEYS.settings, this._settings());
        },
        error: (err) => this.toast.error(apiErrorMessage(err, 'Could not save settings')),
      });
    }
  }

  setSleepTargetHours(hours: number): void {
    const mins = Math.round(Math.min(14, Math.max(4, hours)) * 60);
    this.update({ sleepTargetMinutes: mins });
  }

  private hasSession(): boolean {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.auth);
      if (!raw) return false;
      return Boolean(JSON.parse(raw)?.token);
    } catch {
      return false;
    }
  }
}
