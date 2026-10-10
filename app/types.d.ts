/// <reference types="@vitest/browser/providers/playwright" />

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV?: "development" | "production";
    }
  }
}

/** Production origin under `pnpm dev:prod`, empty otherwise. */
declare const __SERVER_URL__: string;
