// xyra-core runs as its own separate server — not bundled with this app — so
// every call to it is a plain cross-origin fetch(), same pattern as xyra-web's
// webapp/model/config.js.
export const AUTH_BASE_URL = "http://localhost:4004";

// Login only, local dev only: xyra-core picks the tenant from the Host header
// (acme.xyra-ccm.com), and localhost has no tenant subdomain — so login sends
// this and xyra-core honors it only when DEV_MODE=true. After login the tenant
// comes from the session token; no other request sends it.
export const TEST_SUBDOMAIN = "xyrademo";
