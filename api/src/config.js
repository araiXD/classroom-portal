function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var ${name} (see api/.env.example)`);
  return value;
}

// The API acts as the calling user (their JWT + RLS). It must never hold a key
// that bypasses RLS, so refuse to start if one is present in the environment.
if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY must not be set for the API service");
}

// Live notifications are optional: without REALTIME_URL the API just doesn't push them.
const realtimeUrl = process.env.REALTIME_URL?.replace(/\/+$/, "") || null;
const notifySecret = process.env.NOTIFY_SECRET || null;
if (realtimeUrl && (!notifySecret || notifySecret.length < 16)) {
  throw new Error("REALTIME_URL is set, so NOTIFY_SECRET (at least 16 characters) is required");
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  supabaseUrl: required("SUPABASE_URL"),
  supabaseAnonKey: required("SUPABASE_ANON_KEY"),
  corsOrigins: (process.env.CORS_ORIGIN ?? "http://localhost:8000")
    .split(",")
    .map((origin) => origin.trim()),
  realtimeUrl,
  notifySecret,
};
