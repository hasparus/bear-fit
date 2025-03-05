import type {} from "react/canary";

import { createRoot } from "react-dom/client";

import { App } from "./App";

if (process.env.NODE_ENV === "development") {
  const { scan } = await import("react-scan");
  scan({
    enabled: true,
  });
}

createRoot(document.getElementById("app")!).render(<App />);
