import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  template: `
    <div class="empty-state">
      <div class="empty-state__icon" aria-hidden="true">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M8 9h8M8 13h5" />
        </svg>
      </div>
      <h3 class="empty-state__title">{{ title() }}</h3>
      <p class="empty-state__body">{{ message() }}</p>
      @if (actionLabel()) {
        <button type="button" class="btn btn--primary" (click)="action.emit()">
          {{ actionLabel() }}
        </button>
      }
    </div>
  `,
  styles: `:host { display: block; }`,
})
export class EmptyStateComponent {
  readonly title = input('Nothing here yet');
  readonly message = input('Start tracking to see insights.');
  readonly actionLabel = input('');
  readonly action = output<void>();
}
