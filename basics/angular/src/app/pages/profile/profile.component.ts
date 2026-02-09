import {
  Component,
  inject,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { PostHogService } from '../../services/posthog.service';

@Component({
  selector: 'app-profile',
  template: `
    <main id="main-content" tabindex="-1">
      <div class="container">
        <h1>User Profile</h1>

        <div class="stats">
          <h2>Your Information</h2>
          <p><strong>Username:</strong> {{ auth.user()?.username }}</p>
          <p>
            <strong>Burrito Considerations:</strong>
            {{ auth.user()?.burritoConsiderations }}
          </p>
        </div>

        <div style="margin-top: 2rem">
          <button
            (click)="triggerTestError()"
            class="btn-primary"
            style="background-color: #dc3545"
          >
            Trigger Test Error (for PostHog)
          </button>
        </div>

        <div style="margin-top: 2rem">
          <h3>Your Burrito Journey</h3>
          <p>{{ journeyMessage() }}</p>
        </div>
      </div>
    </main>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileComponent {
  readonly auth = inject(AuthService);
  private readonly posthogService = inject(PostHogService);
  private readonly router = inject(Router);

  journeyMessage = computed(() => {
    const count = this.auth.user()?.burritoConsiderations ?? 0;

    if (count === 0) {
      return "You haven't considered any burritos yet. Visit the Burrito Consideration page to start!";
    } else if (count === 1) {
      return "You've considered the burrito potential once. Keep going!";
    } else if (count < 5) {
      return "You're getting the hang of burrito consideration!";
    } else if (count < 10) {
      return "You're becoming a burrito consideration expert!";
    } else {
      return 'You are a true burrito consideration master!';
    }
  });

  constructor() {
    if (!this.auth.isAuthenticated()) {
      this.router.navigate(['/']);
    }
  }

  triggerTestError(): void {
    try {
      throw new Error('Test error for PostHog error tracking');
    } catch (err) {
      const error = err as Error;
      this.posthogService.posthog.capture('$exception', {
        $exception_message: error.message,
        $exception_type: error.name,
        $exception_stack_trace_raw: error.stack,
      });
      console.error('Captured error:', err);
      alert('Error captured and sent to PostHog!');
    }
  }
}
