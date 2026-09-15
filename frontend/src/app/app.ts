import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './core/services/theme.service';
import { SettingsService } from './core/services/settings.service';
import { ToastHostComponent } from './shared/components/toast/toast-host.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastHostComponent],
  template: `
    <router-outlet />
    <app-toast-host />
  `,
  styles: `
    :host {
      display: block;
      min-height: 100dvh;
    }
  `,
})
export class App {
  private readonly theme = inject(ThemeService);
  private readonly settings = inject(SettingsService);

  constructor() {
    const saved = this.settings.settings().theme;
    if (saved) this.theme.setMode(saved);
  }
}
