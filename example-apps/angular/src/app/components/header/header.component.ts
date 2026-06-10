import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-header',
  imports: [RouterLink],
  template: `
    <a class="skip-link" href="#main-content">Skip to main content</a>
    <header class="header" role="banner">
      <div class="header-container">
        <nav aria-label="Main navigation">
          <a routerLink="/">Home</a>
          @if (auth.isAuthenticated()) {
            <a routerLink="/burrito">Burrito Consideration</a>
            <a routerLink="/profile">Profile</a>
          }
        </nav>
        <div class="user-section">
          @if (auth.user(); as user) {
            <span>Welcome, {{ user.username }}!</span>
            <button (click)="auth.logout()" class="btn-logout">Logout</button>
          } @else {
            <span>Not logged in</span>
          }
        </div>
      </div>
    </header>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderComponent {
  readonly auth = inject(AuthService);
}
