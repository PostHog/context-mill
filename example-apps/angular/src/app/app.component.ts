import {
  Component,
  inject,
  OnInit,
  PLATFORM_ID,
  ChangeDetectionStrategy,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './components/header/header.component';
import { AuthService } from './services/auth.service';
import { PostHogService } from './services/posthog.service';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, HeaderComponent],
  template: `
    <app-header />
    <router-outlet />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly posthogService = inject(PostHogService);
  private readonly authService = inject(AuthService);

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const token = environment.posthogKey?.trim();
    // Leave the client uninitialized when NG_APP_POSTHOG_PROJECT_TOKEN is missing rather than using a fallback key.
    if (token) {
      this.posthogService.init(token, {
        api_host: environment.posthogHost,
        defaults: '2026-08-30',
        capture_exceptions: true,
      });

      const restoredUser = this.authService.user();
      if (restoredUser) {
        this.posthogService.posthog?.identify(restoredUser.id, {
          username: restoredUser.username,
        });
      }
    } else if (!environment.production) {
      console.error(
        'NG_APP_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once NG_APP_POSTHOG_PROJECT_TOKEN is configured'
      );
    }
  }
}
