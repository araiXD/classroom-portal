import { HttpError } from "./errors.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const bad = (message) => new HttpError(400, message);

export function bodyOf(req) {
  const body = req.body ?? {};
  if (typeof body !== "object" || Array.isArray(body)) throw bad("Request body must be a JSON object");
  return body;
}

export function uuid(value, field) {
  if (typeof value !== "string" || !UUID.test(value)) throw bad(`${field} must be a UUID`);
  return value;
}

// Trimmed string. Returns null when absent and not required.
export function text(value, field, { max = 200, required = true } = {}) {
  if (value == null || value === "") {
    if (required) throw bad(`${field} is required`);
    return null;
  }
  if (typeof value !== "string") throw bad(`${field} must be a string`);
  const trimmed = value.trim();
  if (!trimmed) {
    if (required) throw bad(`${field} is required`);
    return null;
  }
  if (trimmed.length > max) throw bad(`${field} must be at most ${max} characters`);
  return trimmed;
}

export function isoDate(value, field) {
  if (value == null || value === "") return null;
  const date = typeof value === "string" ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) throw bad(`${field} must be an ISO 8601 date`);
  return date.toISOString();
}
