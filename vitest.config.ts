import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    include: [
      "domain/**/*.test.ts",
      "app/routes/**/*.test.ts",
      "app/utils/**/*.test.ts",
      "workers/**/*.test.ts",
      "scripts/**/*.test.ts",
    ],
  },
});
