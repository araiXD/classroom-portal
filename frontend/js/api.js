import { supabase } from "./supabase-client.js";
import { API_URL } from "./config.js";

// Calls the Express API as the signed-in user. supabase-js keeps the session
// fresh, so grab the token per request rather than caching it.
async function request(method, path, body) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.replace("index.html");
    throw new Error("Not signed in");
  }

  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        ...(body !== undefined && { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error("Could not reach the API. Is it running?");
  }

  const payload = await res.json().catch(() => ({}));
  if (res.status === 401) {
    await supabase.auth.signOut();
    window.location.replace("index.html");
  }
  if (!res.ok) throw new Error(payload.error ?? `Request failed (${res.status})`);
  return payload;
}

export const api = {
  get: (path) => request("GET", path),
  post: (path, body) => request("POST", path, body),
};
