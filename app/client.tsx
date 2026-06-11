import type {} from "react/canary";

import Clarity from "@microsoft/clarity";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import { getUserId } from "./getUserId";

const CLARITY_PROJECT_ID = "qjn2opasep";
Clarity.init(CLARITY_PROJECT_ID);
Clarity.identify(getUserId());

// TODO: Cookie Consent UI.

createRoot(document.getElementById("app")!).render(<App />);
