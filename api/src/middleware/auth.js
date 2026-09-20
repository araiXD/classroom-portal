import { HttpError, unwrap } from "../errors.js";
import { createUserClient } from "../supabase.js";

// Verifies the bearer token with Supabase Auth, loads the caller's profile, and
// attaches `req.user` ({ id, role, full_name }) and `req.db` (a Supabase client
// acting as this user, so RLS applies to every query made through it).
export async function requireAuth(req, res, next) {
  const [scheme, token] = (req.get("authorization") ?? "").split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    throw new HttpError(401, "Missing bearer token");
  }

  const db = createUserClient(token);
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, "Invalid or expired token");

  const profile = unwrap(
    await db.from("profiles").select("full_name, role").eq("id", data.user.id).maybeSingle(),
  );
  if (!profile) throw new HttpError(403, "No profile for this account");

  req.user = { id: data.user.id, ...profile };
  req.db = db;
  next();
}

export function requireRole(role) {
  return (req, res, next) => {
    if (req.user.role !== role) throw new HttpError(403, `Only ${role}s can do this`);
    next();
  };
}
