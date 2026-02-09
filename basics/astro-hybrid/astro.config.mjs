import { defineConfig } from "astro/config";
import node from "@astrojs/node";

export default defineConfig({
  // In Astro 5, 'static' is the default and supports per-page SSR opt-in
  // Use `export const prerender = false` in pages that need server rendering
  output: "static",
  adapter: node({
    mode: "standalone",
  }),
  image: {
    service: { entrypoint: "astro/assets/services/noop" },
  },
});
