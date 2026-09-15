import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { ThemeService } from '../../core/services/theme.service';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './login-page.component.html',
  styleUrl: './auth-pages.css',
})
export class LoginPageComponent {
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  readonly theme = inject(ThemeService);

  email = '';
  password = '';
  readonly submitting = signal(false);
  readonly formError = signal('');

  submit(): void {
    this.formError.set('');
    const email = this.email.trim();
    const password = this.password;

    if (!email || !password) {
      this.formError.set('Email and password are required.');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      this.formError.set('Enter a valid email address.');
      return;
    }

    this.submitting.set(true);
    this.auth.login({ email, password }).subscribe({
      next: () => {
        this.submitting.set(false);
        this.toast.success('Welcome back');
        void this.router.navigateByUrl('/home');
      },
      error: (err: Error) => {
        this.submitting.set(false);
        this.formError.set(err.message);
        this.toast.error(err.message);
      },
    });
  }

  toggleTheme(): void {
    this.theme.toggleLightDark();
  }
}
