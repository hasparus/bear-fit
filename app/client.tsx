import type {} from "react/canary";

import { createRoot } from "react-dom/client";

import { App } from "./App";

createRoot(document.getElementById("app")!).render(<App />);
