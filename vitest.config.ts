import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    name: "panseek",
    root: "./",
    include: ["test/unit/**/*.test.ts"],
    environment: "node",
    globals: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "test/",
        "**/*.d.ts",
        "**/config.ts",
        "**/index.ts",
      ],
    },
  },
  resolve: {
    alias: {
      "#internal": path.resolve(__dirname, ".nuxt"),
    },
  },
});
