import { createClient } from "@supabase/supabase-js";
import { config } from "./config.js";

// One client per request, carrying the caller's JWT, so Postgres evaluates RLS
// as that user. Never share these across requests.
export function createUserClient(accessToken) {
  return createClient(config.supabaseUrl, config.supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
