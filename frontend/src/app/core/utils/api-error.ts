import { HttpErrorResponse } from '@angular/common/http';

export function apiErrorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (err instanceof HttpErrorResponse) {
    const body = err.error as { message?: string } | string | null;
    if (typeof body === 'string' && body.trim()) return body;
    if (body && typeof body === 'object' && body.message) return body.message;
    if (err.status === 0) {
      return 'Cannot reach the API. If the backend is waking up, wait a few seconds and try again.';
    }
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
