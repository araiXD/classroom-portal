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

// File uploads (S3) are optional: without S3_BUCKET the upload/download routes answer 503.
// Credentials are read only from these env vars (api/.env) and handed to the client
// explicitly, so the AWS SDK never falls back to an ambient profile in ~/.aws.
const s3Bucket = process.env.S3_BUCKET || null;
let s3 = null;
if (s3Bucket) {
  s3 = {
    bucket: s3Bucket,
    region: required("AWS_REGION"),
    accessKeyId: required("AWS_ACCESS_KEY_ID"),
    secretAccessKey: required("AWS_SECRET_ACCESS_KEY"),
  };
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
  s3,
};
