import { Injectable, inject, signal } from '@angular/core';
import { AppSettings } from '../models';
import { DEFAULT_SLEEP_TARGET_MINUTES, STORAGE_KEYS } from '../constants/categories';
import { LocalStoreService } from './local-store.service';

const DEFAULTS: AppSettings = {
  sleepTargetMinutes: DEFAULT_SLEEP_TARGET_MINUTES,
  displayName: 'You',
  theme: 'system',
};

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly store = inject(LocalStoreService);
  private readonly _settings = signal<AppSettings>({
    ...DEFAULTS,
    ...this.store.get<Partial<AppSettings>>(STORAGE_KEYS.settings, {}),
  });

  readonly settings = this._settings.asReadonly();

  update(partial: Partial<AppSettings>): void {
    this._settings.update((s) => {
      const next = { ...s, ...partial };
      this.store.set(STORAGE_KEYS.settings, next);
      return next;
    });
  }

  setSleepTargetHours(hours: number): void {
    const mins = Math.round(Math.min(14, Math.max(4, hours)) * 60);
    this.update({ sleepTargetMinutes: mins });
  }
}
