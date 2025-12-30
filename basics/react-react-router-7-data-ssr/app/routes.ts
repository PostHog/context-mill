import Root, { RootErrorBoundary } from "./root.js";
import Home from "./routes/home.js";
import Burrito from "./routes/burrito.js";
import Profile from "./routes/profile.js";

export default [
  {
    path: "/",
    Component: Root,
    ErrorBoundary: RootErrorBoundary,
    children: [
      {
        index: true,
        Component: Home,
      },
      {
        path: "burrito",
        Component: Burrito,
      },
      {
        path: "profile",
        Component: Profile,
      },
    ],
  },
];

