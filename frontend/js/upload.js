import { api } from "./api.js";
import { el } from "./dom.js";

// What the file pickers offer. The API is the real gatekeeper (allowed types and the size
// cap live in api/src/files.js, and S3 enforces them too); this is just for the user.
export const FILE_ACCEPT = ".pdf,.txt,.png,.jpg,.jpeg,.docx";
export const FILE_HINT = "PDF, text, PNG, JPEG or Word (.docx), up to 5 MB";

// Wrapped so tests can observe it; a real browser just starts the download.
export const browser = { open: (url) => window.location.assign(url) };

// Upload one file straight to S3 and return its object key:
//   1. ask the API for a presigned POST (it checks what you're allowed to attach to),
//   2. POST the file to S3 with it,
//   3. hand back the key, which the caller stores as attachment_url / file_url.
// `target` is { kind: "attachment", class_id } or { kind: "submission", assignment_id }.
export async function uploadFile(file, target) {
  const { url, fields, key } = await api.post("/uploads", {
    ...target,
    filename: file.name,
    content_type: file.type,
    size: file.size,
  });

  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) form.append(name, value);
  form.append("file", file); // S3 requires the file to be the last field

  let res;
  try {
    res = await fetch(url, { method: "POST", body: form });
  } catch {
    throw new Error("Upload failed. If this keeps happening, check the storage bucket's CORS settings.");
  }
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).match(/<Message>([^<]*)<\/Message>/)?.[1];
    throw new Error(`Upload rejected by storage${detail ? `: ${detail}` : ` (${res.status})`}`);
  }
  return key;
}

// Ask the API for a fresh short-lived download URL (it checks you may read the row), then
// start the download. The URL forces "attachment", so the page you're on isn't replaced.
export async function downloadFile(path) {
  const { url } = await api.get(path);
  browser.open(url);
}

export function downloadButton(label, path, onError) {
  return el(
    "button",
    {
      type: "button",
      class: "secondary",
      onclick: async () => {
        try {
          await downloadFile(path);
        } catch (err) {
          onError(err);
        }
      },
    },
    label,
  );
}
