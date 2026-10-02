import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { STORAGE_KEYS } from '../constants/categories';

function isJwtExpired(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(base64));
    return typeof payload.exp === 'number' && Date.now() >= payload.exp * 1000;
  } catch {
    return false;
  }
}

/** Reads JWT from localStorage to avoid HttpClient ↔ AuthService DI cycles. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  let token: string | null = null;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.auth);
    if (raw) {
      const parsed = JSON.parse(raw) as { token?: string };
      token = parsed?.token ?? null;
      if (token && token.split('.').length !== 3) token = null;
    }
  } catch {
    token = null;
  }

  if (token && isJwtExpired(token)) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('auth:expired'));
    }
    token = null;
  }

  const reqToSend = token
    ? req.clone({
        setHeaders: { Authorization: `Bearer ${token}` },
      })
    : req;

  return next(reqToSend).pipe(
    catchError((err: HttpErrorResponse) => {
      if (
        err.status === 401 &&
        !req.url.includes('/auth/login') &&
        !req.url.includes('/auth/register')
      ) {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('auth:expired'));
        }
      }
      return throwError(() => err);
    })
  );
};
