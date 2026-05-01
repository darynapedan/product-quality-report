import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <nav class="page-nav">
      <a routerLink="/quality-report" routerLinkActive="active">Product Quality Report</a>
      <a routerLink="/backlog" routerLinkActive="active">Engineering Backlog</a>
    </nav>
    <router-outlet />
  `,
  styles: [`
    .page-nav {
      display: flex;
      gap: 0;
      background: var(--bg-card);
      border-bottom: 1px solid var(--border);
      padding: 0 1.5rem;
    }
    .page-nav a {
      padding: 0.75rem 1.25rem;
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--text-secondary);
      text-decoration: none;
      border-bottom: 2px solid transparent;
      transition: color 0.15s, border-color 0.15s;
    }
    .page-nav a:hover {
      color: var(--text-primary);
    }
    .page-nav a.active {
      color: var(--accent-blue);
      border-bottom-color: var(--accent-blue);
    }
  `]
})
export class AppComponent {}
