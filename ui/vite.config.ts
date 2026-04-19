import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { createUiDevWatchOptions } from "./src/lib/vite-watch";

/** ES2022+ so dependency prebundle accepts top-level `await` (`@tursodatabase/database-wasm` vite helper). */
const JS_TARGET = "es2022" as const;

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  build: {
    minify: "esbuild",
    target: JS_TARGET,
  },
  /** Required for esbuild pre-bundling of deps that use top-level await (Turso WASM). */
  optimizeDeps: {
    esbuildOptions: {
      target: JS_TARGET,
    },
  },
  esbuild: {
    target: JS_TARGET,
    ...(mode === "production"
      ? {
          drop: ["console", "debugger"] as const,
          legalComments: "none" as const,
        }
      : {}),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      lexical: path.resolve(__dirname, "./node_modules/lexical/Lexical.mjs"),
    },
  },
  server: {
    port: 5173,
    /** Required for Turso `@tursodatabase/database-wasm` (SharedArrayBuffer / cross-origin isolation). */
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "credentialless",
    },
    watch: createUiDevWatchOptions(process.cwd()),
    proxy: {
      "/api": {
        target: "http://localhost:3100",
        ws: true,
      },
    },
  },
  preview: {
    port: 4173,
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "credentialless",
    },
  },
}));
