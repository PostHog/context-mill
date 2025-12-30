import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  build: {
    outDir: "build/client",
    rollupOptions: {
      input: resolve(__dirname, "index.html"),
    },
  },
  ssr: {
    noExternal: ["react", "react-dom", "react-router", "posthog-js", "@posthog/react"],
  },
});

