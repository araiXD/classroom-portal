export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Unwrap a supabase-js `{ data, error }` result, turning database errors into
// HttpErrors. RLS rejections (42501) surface as 403 without echoing Postgres's
// internal message.
export function unwrap({ data, error }) {
  if (!error) return data;

  if (error.code === "42501") throw new HttpError(403, "Forbidden");
  if (error.code === "23505") throw new HttpError(409, "Already exists");
  if (error.code === "P0002") throw new HttpError(404, error.message); // join_class: invalid code
  if (error.code?.startsWith("PGRST30")) throw new HttpError(401, "Invalid or expired token");

  console.error("Unexpected database error:", error);
  throw new HttpError(500, "Internal server error");
}

// Express 5 forwards rejected async handlers here.
export function errorHandler(err, req, res, next) {
  if (err instanceof HttpError || err.expose === true) {
    return res.status(err.status ?? 400).json({ error: err.message });
  }
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
}
