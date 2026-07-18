import { resolve } from "node:path";

import { defineConfig } from "vite";

const root = resolve(import.meta.dirname, "web");

export default defineConfig({
  root,
  base: "/",
  build: {
    target: "es2022",
    outDir: resolve(import.meta.dirname, "agent_msg"),
    emptyOutDir: false,
    minify: false,
    rollupOptions: {
      input: resolve(root, "portal.html"),
      output: {
        entryFileNames: "static/portal.js",
        assetFileNames: "static/portal.[ext]",
      },
    },
  },
});
