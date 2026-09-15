import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { LocalStoreService } from './local-store.service';
import { STORAGE_KEYS } from '../constants/categories';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly store = inject(LocalStoreService);
  private readonly mode = signal<ThemeMode>(
    this.store.get<ThemeMode>(STORAGE_KEYS.theme, 'system'),
  );

  readonly themeMode = this.mode.asReadonly();

  readonly resolved = computed<ResolvedTheme>(() => {
    const m = this.mode();
    if (m === 'system') {
      return this.prefersDark() ? 'dark' : 'light';
    }
    return m;
  });

  constructor() {
    effect(() => {
      const resolved = this.resolved();
      document.documentElement.setAttribute('data-theme', resolved);
      document.documentElement.style.colorScheme = resolved;
    });

    if (typeof window !== 'undefined' && window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (this.mode() === 'system') {
          this.mode.set('system');
        }
      });
    }
  }

  setMode(mode: ThemeMode): void {
    this.mode.set(mode);
    this.store.set(STORAGE_KEYS.theme, mode);
  }

  toggleLightDark(): void {
    const next: ThemeMode = this.resolved() === 'dark' ? 'light' : 'dark';
    this.setMode(next);
  }

  private prefersDark(): boolean {
    return typeof window !== 'undefined' &&
      !!window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  }
}
