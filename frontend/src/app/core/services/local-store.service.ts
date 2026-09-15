import { Injectable } from '@angular/core';

/**
 * Thin localStorage wrapper.
 * Swap point: replace get/set with HTTP when Express+Mongo is ready.
 */
@Injectable({ providedIn: 'root' })
export class LocalStoreService {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key);
      if (raw == null) return fallback;
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  set<T>(key: string, value: T): void {
    localStorage.setItem(key, JSON.stringify(value));
  }

  remove(key: string): void {
    localStorage.removeItem(key);
  }
}
