import { portalContent } from "./portalContent.js";

const SESSION_KEY = "digital-twin-portal-session-v1";

// This is the existing demo login, not a backend authorization token.
// Keep only the account identity in this tab; never persist the password.
export function signInDemoAccount(username, password, storage = window.sessionStorage) {
  if (username !== portalContent.demoEmail || password !== portalContent.demoPassword) return false;
  storage.setItem(SESSION_KEY, JSON.stringify({ version: 1, username }));
  return true;
}

export function canUseDeveloperViewer({ development = import.meta.env?.DEV === true, storage } = {}) {
  if (development) return true;
  try {
    const session = JSON.parse((storage ?? window.sessionStorage).getItem(SESSION_KEY) || "null");
    return session?.version === 1 && session.username === portalContent.demoEmail;
  } catch { return false; }
}

export function isDeveloperViewer(search, options) {
  return new URLSearchParams(search).get("developer") === "1" && canUseDeveloperViewer(options);
}
