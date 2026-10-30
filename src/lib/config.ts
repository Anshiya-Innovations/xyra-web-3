declare global {
  interface Window {
    __XYRA_API_URL__?: string;
  }
}

// In production on SAP BTP Cloud Foundry, set VITE_AUTH_BASE_URL to your backend URL
// (e.g. https://forte-innovations-llc-composed-digitalized-framework-ap25ce94a1.cfapps.us10-001.hana.ondemand.com).
// If unset in local dev, it falls back to Vite proxy ("") or http://localhost:4004.
export const AUTH_BASE_URL =
  (import.meta.env.VITE_AUTH_BASE_URL !== undefined
    ? import.meta.env.VITE_AUTH_BASE_URL
    : import.meta.env.VITE_API_URL) ||
  (typeof window !== "undefined" && window.__XYRA_API_URL__) ||
  (typeof window !== "undefined" &&
  window.location.hostname !== "localhost" &&
  window.location.hostname !== "127.0.0.1"
    ? window.location.origin.replace(/xyra-web(-\d+)?/i, "xyra-core")
    : "");

export const TEST_SUBDOMAIN = "xyrademo";
