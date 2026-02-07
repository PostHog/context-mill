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

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.posthogService.init(environment.posthogKey, {
        api_host: '/ingest',
        ui_host: environment.posthogHost || 'https://us.posthog.com',
        capture_exceptions: true,
      });
    }
  }
}
