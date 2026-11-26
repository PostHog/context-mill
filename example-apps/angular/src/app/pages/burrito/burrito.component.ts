import {
  Component,
  inject,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { PostHogService } from '../../services/posthog.service';

@Component({
  selector: 'app-burrito',
  template: `
    <main id="main-content" tabindex="-1">
      <div class="container">
        <h1>Burrito consideration zone</h1>
        <p>Take a moment to truly consider the potential of burritos.</p>

        <div style="text-align: center">
          <button (click)="handleConsideration()" class="btn-burrito">
            I have considered the burrito potential
          </button>

          @if (hasConsidered()) {
            <p class="success" role="status" aria-live="polite">
              Thank you for your consideration! Count:
              {{ auth.user()?.burritoConsiderations }}
            </p>
          }
        </div>

        <div class="stats">
          <h3>Consideration stats</h3>
          <p>Total considerations: {{ auth.user()?.burritoConsiderations }}</p>
        </div>
      </div>
    </main>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BurritoComponent {
  readonly auth = inject(AuthService);
  private readonly posthogService = inject(PostHogService);
  private readonly router = inject(Router);

  hasConsidered = signal(false);

  constructor() {
    // Redirect if not authenticated
    if (!this.auth.isAuthenticated()) {
      this.router.navigate(['/']);
    }
  }

  handleConsideration(): void {
    const user = this.auth.user();
    // Skip event capture when no authenticated user session is active.
    if (!user) return;

    this.auth.incrementBurritoConsiderations();
    const updatedCount =
      this.auth.user()?.burritoConsiderations ?? user.burritoConsiderations + 1;
    this.hasConsidered.set(true);
    setTimeout(() => this.hasConsidered.set(false), 2000);

    // Send only non-PII event metadata. Never include username or email in capture() properties.
    this.posthogService.posthog?.capture('burrito_considered', {
      total_considerations: updatedCount,
    });
  }
}
