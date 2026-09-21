import { randomBytes } from "node:crypto";
import { HttpError } from "./errors.js";

// Guardrails for uploaded files. Adjust here.
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_CONTENT_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "image/png",
  "image/jpeg",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
]);

// The assignments.attachment_url and submissions.file_url columns hold S3 object KEYS
// (not URLs), always in one of these shapes. Express mints them at upload time, checks
// them again on write, and checks them once more before signing a download, because
// RLS lets a user write those columns straight to Supabase without going through us.
//
//   attachments/<class id>/<teacher id>/<32 hex>/<file name>
//   submissions/<assignment id>/<student id>/<32 hex>/<file name>
//
// The <32 hex> is random, the name is sanitized, and the name can't start with "."
// so a key can never contain a "." or ".." path segment.
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const NAME_TAIL = "[0-9a-f]{32}/[A-Za-z0-9_-][A-Za-z0-9._-]{0,99}";

function lowerUuid(value) {
  if (typeof value !== "string" || !new RegExp(`^${UUID}$`, "i").test(value)) {
    throw new Error("expected a UUID");
  }
  return value.toLowerCase();
}

// Reduce an untrusted file name to [A-Za-z0-9._-], at most 100 characters, keeping
// the extension, never starting with "." (so never "." or "..").
export function sanitizeFilename(name) {
  const base = String(name).split(/[\\/]/).pop() ?? "";
  const ext = base.match(/\.([A-Za-z0-9]{1,10})$/)?.[1];
  let safe = base
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip combining accents: e + \u0301 -> e
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/\.{2,}/g, ".")
    .replace(/^[._]+/, "");
  if (safe.length > 100) safe = safe.slice(-100).replace(/^[._]+/, "");
  if (ext && safe === ext) safe = `file.${ext}`; // "日本語.pdf" -> "file.pdf", not "pdf"
  return safe || "file";
}

const randomPart = () => randomBytes(16).toString("hex");

export const newAttachmentKey = (classId, userId, filename) =>
  `attachments/${lowerUuid(classId)}/${lowerUuid(userId)}/${randomPart()}/${sanitizeFilename(filename)}`;

export const newSubmissionKey = (assignmentId, userId, filename) =>
  `submissions/${lowerUuid(assignmentId)}/${lowerUuid(userId)}/${randomPart()}/${sanitizeFilename(filename)}`;

// Pass userId to require a specific uploader (writes); omit it to accept any (reads:
// only the class's teacher can mint keys under a class's prefix in the first place).
export const attachmentKeyRe = (classId, userId) =>
  new RegExp(`^attachments/${lowerUuid(classId)}/${userId ? lowerUuid(userId) : UUID}/${NAME_TAIL}$`);

export const submissionKeyRe = (assignmentId, userId) =>
  new RegExp(`^submissions/${lowerUuid(assignmentId)}/${lowerUuid(userId)}/${NAME_TAIL}$`);

// Optional request-body field holding a key from POST /uploads. Null when absent.
export function fileKey(value, field, pattern) {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || !pattern.test(value)) {
    throw new HttpError(400, `${field} must be a key returned by POST /uploads for this ${field === "file_url" ? "assignment" : "class"}`);
  }
  return value;
}

export const filenameOf = (key) => key.slice(key.lastIndexOf("/") + 1);
