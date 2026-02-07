import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    title: 'Burrito Consideration App',
    loadComponent: () =>
      import('./pages/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'burrito',
    title: 'Burrito Consideration - Burrito Consideration App',
    loadComponent: () =>
      import('./pages/burrito/burrito.component').then(
        (m) => m.BurritoComponent
      ),
    canActivate: [authGuard],
  },
  {
    path: 'profile',
    title: 'Profile - Burrito Consideration App',
    loadComponent: () =>
      import('./pages/profile/profile.component').then(
        (m) => m.ProfileComponent
      ),
    canActivate: [authGuard],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
