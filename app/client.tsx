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

if (
  typeof window !== "undefined" &&
  window.location.pathname === "/dashboard"
) {
  window.location.pathname = "/dashboard.html";
} else {
  createRoot(document.getElementById("app")!).render(<App />);
}
