/// <reference types="@cloudflare/workers-types" />

declare module "*.module.css" {
  declare const styles: Record<string, string>;
  export = styles;
}

declare const APP_VERSION: string;
