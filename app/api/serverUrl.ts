let ALWAYS_PROD = import.meta.env.ALWAYS_PROD === 1;
if (process.env.NODE_ENV === "test") ALWAYS_PROD = false;

if (ALWAYS_PROD) {
  console.log("🌎 Running against production server.");
} else if (process.env.NODE_ENV === "development") {
  console.log("🏠 Running against the local server.");
}

export const serverUrl = ALWAYS_PROD
  ? "https://bear-fit.hasparus.partykit.dev"
  : `${window.location.protocol}//${window.location.host}`;
