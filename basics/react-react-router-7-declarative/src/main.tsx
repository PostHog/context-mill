import './globals.css'

import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router";
import Root from './routes/Root';
import Home from './routes/Home';
import Burrito from './routes/Burrito';
import Profile from './routes/Profile';

import posthog from 'posthog-js';
import { PostHogErrorBoundary, PostHogProvider } from '@posthog/react'

posthog.init(import.meta.env.VITE_PUBLIC_POSTHOG_KEY, {
  api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
  defaults: '2025-11-30',
});

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

ReactDOM.createRoot(root).render(
  <StrictMode>
    <PostHogProvider client={posthog}>
    <PostHogErrorBoundary>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Root />}>
          <Route index element={<Home />} />
          <Route path="burrito" element={<Burrito />} />
          <Route path="profile" element={<Profile />} />
          </Route>
        </Routes>
      </BrowserRouter>
      </PostHogErrorBoundary> 
    </PostHogProvider>
  </StrictMode>,
);

