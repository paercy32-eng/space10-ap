import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Runtime Supabase configuration.
//
// Credentials can come from two places, checked in this order:
//   1. localStorage -- set via the in-app "Supabase setup" screen. Wins if
//      present, and needs no rebuild to change.
//   2. import.meta.env.VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY -- the
//      .env file, for anyone who prefers the build-time approach.
//
// Nothing here is hardcoded, and no credentials live in the application
// code anywhere else -- every other file imports the already-built
// `supabase` client from here, or the helper functions below.
// ---------------------------------------------------------------------------

const STORAGE_KEY_URL = "space10_supabase_url";
const STORAGE_KEY_ANON_KEY = "space10_supabase_anon_key";

function readStoredConfig() {
  try {
    const url = window.localStorage.getItem(STORAGE_KEY_URL);
    const anonKey = window.localStorage.getItem(STORAGE_KEY_ANON_KEY);
    if (url && anonKey) return { url, anonKey, source: "runtime setup screen" };
  } catch {
    // localStorage unavailable (private browsing, etc.) -- fall through.
  }
  return null;
}

function readEnvConfig() {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (url && anonKey) return { url, anonKey, source: ".env file" };
  return null;
}

let activeConfig = readStoredConfig() || readEnvConfig();

// `let`, not `const` -- reassigned by saveSupabaseConfig()/clearSupabaseConfig()
// below. Every other file does `import { supabase } from "./lib/supabaseClient"`
// and calls e.g. `supabase.auth.getSession()` fresh each time, so this live
// binding is picked up automatically the moment configuration is saved --
// no restart, no page reload needed.
export let supabase = activeConfig ? createClient(activeConfig.url, activeConfig.anonKey) : null;

export function isConfigured() {
  return !!supabase;
}

export function getConfiguredUrl() {
  return activeConfig?.url || "";
}

export function getConfigSource() {
  return activeConfig?.source || null;
}

export function hasSavedAnonKey() {
  try {
    return !!window.localStorage.getItem(STORAGE_KEY_ANON_KEY);
  } catch {
    return false;
  }
}

/**
 * Saves Project URL + anon key from the setup screen and immediately
 * (re)builds the live `supabase` client. Pass an empty anonKey to keep
 * whatever key is already saved (used when the user only wants to update
 * the URL without re-entering the key).
 */
export function saveSupabaseConfig(url, anonKey) {
  const cleanUrl = (url || "").trim().replace(/\/+$/, "");
  if (!cleanUrl) throw new Error("Project URL is required.");
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(cleanUrl)) {
    throw new Error("That doesn't look like a Supabase project URL (should look like https://xxxxx.supabase.co).");
  }

  let cleanKey = (anonKey || "").trim();
  if (!cleanKey) {
    // Keep the existing saved key if the user left the field blank.
    try {
      cleanKey = window.localStorage.getItem(STORAGE_KEY_ANON_KEY) || "";
    } catch {
      cleanKey = "";
    }
  }
  if (!cleanKey) throw new Error("Anon/Public Key is required.");

  try {
    window.localStorage.setItem(STORAGE_KEY_URL, cleanUrl);
    window.localStorage.setItem(STORAGE_KEY_ANON_KEY, cleanKey);
  } catch {
    throw new Error("Could not save configuration -- this browser may be blocking local storage (e.g. private/incognito mode).");
  }

  activeConfig = { url: cleanUrl, anonKey: cleanKey, source: "runtime setup screen" };
  supabase = createClient(cleanUrl, cleanKey);
  return supabase;
}

/** Wipes the saved configuration. Falls back to .env if one exists. */
export function clearSupabaseConfig() {
  try {
    window.localStorage.removeItem(STORAGE_KEY_URL);
    window.localStorage.removeItem(STORAGE_KEY_ANON_KEY);
  } catch {
    // ignore
  }
  activeConfig = readEnvConfig();
  supabase = activeConfig ? createClient(activeConfig.url, activeConfig.anonKey) : null;
}
