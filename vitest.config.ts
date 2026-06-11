import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    env: { TZ: process.env.TZ ?? "UTC" },
    environment: "node",
    include: ["app/**/*.test.ts", "party/**/*.test.ts"],
  },
});
