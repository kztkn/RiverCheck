import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    include: [
      "domain/**/*.test.ts",
      "app/**/*.test.ts",
      "app/**/*.test.tsx",
      "server/**/*.test.ts",
      "workers/**/*.test.ts",
      "scripts/**/*.test.ts",
    ],
  },
});
