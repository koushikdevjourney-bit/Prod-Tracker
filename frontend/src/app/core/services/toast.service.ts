import { Injectable, signal } from '@angular/core';
import { ToastKind, ToastMessage } from '../models';
import { createId } from '../utils/stats.utils';

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly _toasts = signal<ToastMessage[]>([]);
  readonly toasts = this._toasts.asReadonly();

  show(message: string, kind: ToastKind = 'success', ttlMs = 3200): void {
    const toast: ToastMessage = { id: createId(), message, kind };
    this._toasts.update((list) => [...list, toast]);
    window.setTimeout(() => this.dismiss(toast.id), ttlMs);
  }

  success(message: string): void {
    this.show(message, 'success');
  }

  error(message: string): void {
    this.show(message, 'error', 4500);
  }

  info(message: string): void {
    this.show(message, 'info');
  }

  warning(message: string): void {
    this.show(message, 'warning', 4000);
  }

  dismiss(id: string): void {
    this._toasts.update((list) => list.filter((t) => t.id !== id));
  }
}
