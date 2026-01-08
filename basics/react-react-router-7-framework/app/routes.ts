import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("burrito", "routes/burrito.tsx"),
  route("profile", "routes/profile.tsx"),
  route("error", "routes/error.tsx"),
  route("api/auth/login", "routes/api.auth.login.ts"),
  route("api/burrito/consider", "routes/api.burrito.consider.ts"),
] satisfies RouteConfig;
