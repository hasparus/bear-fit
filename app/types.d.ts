/// <reference types="@vitest/browser/providers/playwright" />

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV?: "development" | "production";
    }
  }
}
