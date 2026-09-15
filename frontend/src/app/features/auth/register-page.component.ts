import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { ThemeService } from '../../core/services/theme.service';

@Component({
  selector: 'app-register-page',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './register-page.component.html',
  styleUrl: './auth-pages.css',
})
export class RegisterPageComponent {
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  readonly theme = inject(ThemeService);

  name = '';
  email = '';
  password = '';
  confirmPassword = '';
  readonly submitting = signal(false);
  readonly formError = signal('');

  submit(): void {
    this.formError.set('');
    const name = this.name.trim();
    const email = this.email.trim();
    const password = this.password;

    if (!name || !email || !password) {
      this.formError.set('Name, email, and password are required.');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      this.formError.set('Enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      this.formError.set('Password must be at least 6 characters.');
      return;
    }
    if (password !== this.confirmPassword) {
      this.formError.set('Passwords do not match.');
      return;
    }

    this.submitting.set(true);
    this.auth.register({ name, email, password }).subscribe({
      next: () => {
        this.submitting.set(false);
        this.toast.success('Account created');
        void this.router.navigateByUrl('/dashboard');
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
