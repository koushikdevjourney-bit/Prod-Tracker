import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, catchError, map, of, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { STORAGE_KEYS } from '../constants/categories';
import { AuthResponse, AuthUser, ApiErrorBody } from '../models/auth.models';
import { SettingsService } from './settings.service';
import { ToastService } from './toast.service';
import { DataSyncService } from './data-sync.service';

interface StoredSession {
  token: string;
  user: AuthUser;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly settings = inject(SettingsService);
  private readonly toast = inject(ToastService);
  private readonly dataSync = inject(DataSyncService);

  private readonly _token = signal<string | null>(null);
  private readonly _user = signal<AuthUser | null>(null);
  private expirationTimer: ReturnType<typeof setTimeout> | null = null;
  private isHandlingExpiry = false;

  readonly token = this._token.asReadonly();
  readonly user = this._user.asReadonly();
  readonly isAuthenticated = computed(() => this.isJwt(this._token()) && !this.isTokenExpired(this._token()));

  constructor() {
    this.restoreSession();
    this.setupExpiryListeners();
    if (this.isAuthenticated()) this.dataSync.hydrate().subscribe();
  }

  private setupExpiryListeners(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this._token()) {
        if (this.isTokenExpired(this._token())) {
          this.handleSessionExpired(true);
        }
      }
    });

    window.addEventListener('focus', () => {
      if (this._token() && this.isTokenExpired(this._token())) {
        this.handleSessionExpired(true);
      }
    });

    window.addEventListener('auth:expired', () => {
      this.handleSessionExpired(true);
    });
  }

  register(payload: { name: string; email: string; password: string }): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${environment.apiUrl}/auth/register`, payload)
      .pipe(
        tap((res) => this.persistSession(res)),
        catchError((err) => this.handleError(err))
      );
  }

  login(payload: { email: string; password: string }): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${environment.apiUrl}/auth/login`, payload).pipe(
      tap((res) => this.persistSession(res)),
      catchError((err) => this.handleError(err))
    );
  }

  me(): Observable<AuthUser | null> {
    if (!this._token()) return of(null);
    return this.http.get<{ user: AuthUser }>(`${environment.apiUrl}/auth/me`).pipe(
      map((res) => res.user),
      tap((user) => {
        this._user.set(user);
        this.writeStorage({ token: this._token()!, user });
        this.syncDisplayName(user.name);
      }),
      catchError(() => {
        this.clearSession();
        return of(null);
      })
    );
  }

  logout(options: { navigate?: boolean; toast?: boolean } = {}): void {
    const { navigate = true, toast = true } = options;
    this.clearTimer();
    this.dataSync.resetLocal();
    this.clearSession();
    if (toast) this.toast.info('Signed out');
    if (navigate) void this.router.navigateByUrl('/');
  }

  handleSessionExpired(showToast = true): void {
    if (this.isHandlingExpiry) return;
    this.isHandlingExpiry = true;

    this.clearTimer();
    this.dataSync.resetLocal();
    this.clearSession();

    if (showToast) {
      this.toast.warning('Your session has expired (24h limit). Please log in again.');
    }
    void this.router.navigateByUrl('/login').finally(() => {
      setTimeout(() => {
        this.isHandlingExpiry = false;
      }, 1000);
    });
  }

  getToken(): string | null {
    const tok = this._token();
    return this.isJwt(tok) && !this.isTokenExpired(tok) ? tok : null;
  }

  getTokenExpiration(token: string | null): number | null {
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    try {
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(atob(base64));
      return typeof payload.exp === 'number' ? payload.exp : null;
    } catch {
      return null;
    }
  }

  isTokenExpired(token: string | null): boolean {
    if (!token) return true;
    const exp = this.getTokenExpiration(token);
    if (!exp) return false;
    return Date.now() >= exp * 1000;
  }

  private scheduleExpiration(token: string): void {
    this.clearTimer();
    const exp = this.getTokenExpiration(token);
    if (!exp) return;

    const remainingMs = exp * 1000 - Date.now();
    if (remainingMs <= 0) {
      this.handleSessionExpired(true);
      return;
    }

    this.expirationTimer = setTimeout(() => {
      this.handleSessionExpired(true);
    }, remainingMs);
  }

  private clearTimer(): void {
    if (this.expirationTimer) {
      clearTimeout(this.expirationTimer);
      this.expirationTimer = null;
    }
  }

  private isJwt(token: string | null): boolean {
    return Boolean(token && token.split('.').length === 3);
  }

  private restoreSession(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.auth);
      if (!raw) return;
      const parsed = JSON.parse(raw) as StoredSession;
      if (parsed?.token && parsed?.user && this.isJwt(parsed.token)) {
        if (this.isTokenExpired(parsed.token)) {
          this.handleSessionExpired(true);
          return;
        }
        this._token.set(parsed.token);
        this._user.set(parsed.user);
        this.syncDisplayName(parsed.user.name);
        this.scheduleExpiration(parsed.token);
      } else {
        localStorage.removeItem(STORAGE_KEYS.auth);
      }
    } catch {
      localStorage.removeItem(STORAGE_KEYS.auth);
    }
  }

  private persistSession(res: AuthResponse): void {
    this._token.set(res.token);
    this._user.set(res.user);
    this.writeStorage({ token: res.token, user: res.user });
    this.syncDisplayName(res.user.name);
    this.scheduleExpiration(res.token);
    this.dataSync.hydrate().subscribe();
  }

  private writeStorage(session: StoredSession): void {
    localStorage.setItem(STORAGE_KEYS.auth, JSON.stringify(session));
  }

  private clearSession(): void {
    this.clearTimer();
    this._token.set(null);
    this._user.set(null);
    localStorage.removeItem(STORAGE_KEYS.auth);
  }

  private syncDisplayName(name: string): void {
    if (name) this.settings.update({ displayName: name }, { persist: false });
  }

  private handleError(err: HttpErrorResponse): Observable<never> {
    const body = err.error as ApiErrorBody | string | null;
    let message = 'Something went wrong. Please try again.';
    const raw =
      (typeof body === 'string' && body.trim()) ||
      (body && typeof body === 'object' && body.message) ||
      err.message ||
      '';
    const unreachable =
      err.status === 0 ||
      /failed to fetch|unknown error|network/i.test(String(raw));

    if (unreachable) {
      message =
        'Cannot reach the API. Start the backend (backend folder: npm run dev) or wait if Render is waking up.';
    } else if (typeof body === 'string' && body.trim()) {
      message = body;
    } else if (body && typeof body === 'object' && body.message) {
      message = body.message;
    } else if (err.status === 401) {
      message = 'Invalid email or password';
    }
    return throwError(() => new Error(message));
  }
}
