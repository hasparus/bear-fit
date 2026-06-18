/// <reference types="@vitest/browser/providers/playwright" />

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV?: "development" | "production";
    }
  }
}

interface ImportMeta {
  env: ImportMetaEnv;
}

interface ImportMetaEnv {
  readonly ALWAYS_PROD: 0 | 1;
}

declare const __PROD_SERVER_URL__: string;
