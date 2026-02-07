import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: '',
    renderMode: RenderMode.Server,
  },
  {
    path: 'burrito',
    renderMode: RenderMode.Client, // Protected route, render client-side
  },
  {
    path: 'profile',
    renderMode: RenderMode.Client, // Protected route, render client-side
  },
  {
    path: '**',
    renderMode: RenderMode.Server,
  },
];
