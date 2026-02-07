import {
  Component,
  inject,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-home',
  imports: [ReactiveFormsModule],
  template: `
    <main id="main-content" tabindex="-1">
      @if (auth.user(); as user) {
        <div class="container">
          <h1>Welcome back, {{ user.username }}!</h1>
          <p>You are now logged in. Feel free to explore:</p>
          <ul>
            <li>Consider the potential of burritos</li>
            <li>View your profile and statistics</li>
          </ul>
        </div>
      } @else {
        <div class="container">
          <h1>Welcome to Burrito Consideration App</h1>
          <p>Please sign in to begin your burrito journey</p>

          <form [formGroup]="loginForm" (ngSubmit)="handleSubmit()" class="form">
            <div class="form-group">
              <label for="username">Username:</label>
              <input
                type="text"
                id="username"
                formControlName="username"
                placeholder="Enter any username"
                autocomplete="username"
              />
            </div>

            <div class="form-group">
              <label for="password">Password:</label>
              <input
                type="password"
                id="password"
                formControlName="password"
                placeholder="Enter any password"
                autocomplete="current-password"
              />
            </div>

            @if (error()) {
              <p class="error" role="alert">{{ error() }}</p>
            }

            <button type="submit" class="btn-primary">Sign In</button>
          </form>

          <p class="note">
            Note: This is a demo app. Use any username and password to sign in.
          </p>
        </div>
      }
    </main>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent {
  private readonly fb = inject(FormBuilder);
  readonly auth = inject(AuthService);

  loginForm = this.fb.nonNullable.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
  });

  error = signal('');

  handleSubmit(): void {
    this.error.set('');

    if (this.loginForm.invalid) {
      this.error.set('Please provide both username and password');
      return;
    }

    const { username, password } = this.loginForm.getRawValue();

    const success = this.auth.login(username, password);
    if (success) {
      this.loginForm.reset();
    } else {
      this.error.set('Please provide both username and password');
    }
  }
}
