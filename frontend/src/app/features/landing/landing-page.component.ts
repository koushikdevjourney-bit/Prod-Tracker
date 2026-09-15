import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ThemeService } from '../../core/services/theme.service';

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './landing-page.component.html',
  styleUrl: './landing-page.component.css',
})
export class LandingPageComponent {
  readonly theme = inject(ThemeService);

  readonly features = [
    {
      title: 'Track your day',
      body: 'Log activities with auto duration, overnight support, and a clean timeline of where hours go.',
      icon: '◎',
    },
    {
      title: 'Hit your goals',
      body: 'Set daily targets for DSA, coding, exercise, and more — progress updates from real logs.',
      icon: '★',
    },
    {
      title: 'See the pattern',
      body: 'Habits, sleep, productivity score, and weekly analytics so every week compounds.',
      icon: '☰',
    },
  ];

  toggleTheme(): void {
    this.theme.toggleLightDark();
  }
}
