import React from "react";
import type { RouteObject } from "react-router";
import Root, { RootErrorBoundary } from "./root";
import Home from "./routes/home";
import Burrito from "./routes/burrito";
import Profile from "./routes/profile";

export const routes: RouteObject[] = [
  {
    path: "/",
    element: <Root />,
    ErrorBoundary: RootErrorBoundary,
    children: [
      {
        index: true,
        element: <Home />,
      },
      {
        path: "burrito",
        element: <Burrito />,
      },
      {
        path: "profile",
        element: <Profile />,
      },
    ],
  },
];

