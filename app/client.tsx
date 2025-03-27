import type {} from "react/canary";

import { createRoot } from "react-dom/client";

import { App } from "./App";

const SCAN = false;
if (process.env.NODE_ENV === "development" && SCAN) {
  const { scan } = await import("react-scan");
  scan({
    enabled: true,
  });
}

console.log("import.meta.env.ALWAYS_PROD", import.meta.env.ALWAYS_PROD);
console.log("window.APP_VERSION", (window as any).APP_VERSION);

let ALWAYS_PROD = import.meta.env.ALWAYS_PROD === 1;
if (process.env.NODE_ENV === "test") ALWAYS_PROD = false;

if (ALWAYS_PROD) {
  console.log("🌎 Running against production server.");
} else if (process.env.NODE_ENV === "development") {
  console.log("🏠 Running against the local server.");
}

const serverUrl = ALWAYS_PROD
  ? "https://bear-fit.hasparus.partykit.dev"
  : `${window.location.protocol}//${window.location.host}`;

createRoot(document.getElementById("app")!).render(
  <App serverUrl={serverUrl} />,
);
