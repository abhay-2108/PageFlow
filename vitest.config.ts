import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/shared/**/*.test.ts"],
    environment: "node",
  },
});
