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

  readonly token = this._token.asReadonly();
  readonly user = this._user.asReadonly();
  readonly isAuthenticated = computed(() => !!this._token());

  constructor() {
    this.restoreSession();
    if (this._token()) this.dataSync.hydrate().subscribe();
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
    this.dataSync.resetLocal();
    this.clearSession();
    if (toast) this.toast.info('Signed out');
    if (navigate) void this.router.navigateByUrl('/');
  }

  getToken(): string | null {
    return this._token();
  }

  private restoreSession(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.auth);
      if (!raw) return;
      const parsed = JSON.parse(raw) as StoredSession;
      if (parsed?.token && parsed?.user) {
        this._token.set(parsed.token);
        this._user.set(parsed.user);
        this.syncDisplayName(parsed.user.name);
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
    this.dataSync.hydrate().subscribe();
  }

  private writeStorage(session: StoredSession): void {
    localStorage.setItem(STORAGE_KEYS.auth, JSON.stringify(session));
  }

  private clearSession(): void {
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
