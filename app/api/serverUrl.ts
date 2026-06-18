let ALWAYS_PROD = import.meta.env.ALWAYS_PROD === 1;
if (process.env.NODE_ENV === "test") ALWAYS_PROD = false;

if (ALWAYS_PROD) {
  console.log("🌎 Running against production server.");
} else if (process.env.NODE_ENV === "development") {
  console.log("🏠 Running against the local server.");
}

const sameOrigin = `${window.location.protocol}//${window.location.host}`;

const PROD_SERVER_URL =
  typeof __PROD_SERVER_URL__ === "string" && __PROD_SERVER_URL__
    ? __PROD_SERVER_URL__
    : sameOrigin;

export const serverUrl = ALWAYS_PROD ? PROD_SERVER_URL : sameOrigin;
