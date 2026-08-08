import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["domain/**/*.test.ts", "app/utils/**/*.test.ts"],
  },
});
