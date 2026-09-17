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
      title: 'Choose your roles',
      body: 'Start from SDE, AI/ML, Data Analyst or DevOps packs — or create a role of your own.',
      icon: 'roles',
    },
    {
      title: 'Drag in topics',
      body: 'Drag predefined topics into a role, then reorder skills and sub-trackers however you like.',
      icon: 'topics',
    },
    {
      title: 'Track the details',
      body: 'Every skill gets priority stars and its own checklist of sub-trackers.',
      icon: 'details',
    },
  ];

  toggleTheme(): void {
    this.theme.toggleLightDark();
  }
}
