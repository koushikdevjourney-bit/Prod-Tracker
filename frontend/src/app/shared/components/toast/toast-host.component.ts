import { Component, inject } from '@angular/core';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-toast-host',
  standalone: true,
  template: `
    <div class="toast-host" aria-live="polite">
      @for (t of toast.toasts(); track t.id) {
        <div class="toast" [attr.data-kind]="t.kind" role="status">
          <span>{{ t.message }}</span>
          <button type="button" class="toast__close" (click)="toast.dismiss(t.id)" aria-label="Dismiss">×</button>
        </div>
      }
    </div>
  `,
  styles: `:host { display: contents; }`,
})
export class ToastHostComponent {
  readonly toast = inject(ToastService);
}
