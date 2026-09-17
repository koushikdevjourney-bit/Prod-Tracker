import { HttpInterceptorFn } from '@angular/common/http';
import { STORAGE_KEYS } from '../constants/categories';

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

  if (!token) return next(req);

  return next(
    req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    })
  );
};
