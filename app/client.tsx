import type {} from "react/canary";

import Clarity from "@microsoft/clarity";
import { createRoot } from "react-dom/client";

import { App, getCalendarProvider } from "./App";
import { getUserId } from "./getUserId";

const calendarId = new URLSearchParams(window.location.search).get("id");
if (calendarId) getCalendarProvider(calendarId);

const CLARITY_PROJECT_ID = "qjn2opasep";
Clarity.init(CLARITY_PROJECT_ID);
Clarity.identify(getUserId());

// TODO: Cookie Consent UI.

const SCAN = false;
if (process.env.NODE_ENV === "development" && SCAN) {
  const { scan } = await import("react-scan");
  scan({
    enabled: true,
  });
}

createRoot(document.getElementById("app")!).render(<App />);
