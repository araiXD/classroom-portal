import { Router } from "express";
import { config } from "../config.js";
import { HttpError, unwrap } from "../errors.js";
import { ALLOWED_CONTENT_TYPES, MAX_FILE_BYTES, newAttachmentKey, newSubmissionKey } from "../files.js";
import { presignUpload } from "../s3.js";
import { bodyOf, text, uuid } from "../validate.js";

export const uploadsRouter = Router();

// Ask for permission to upload one file straight to S3. Body:
//   { kind: "attachment", class_id, filename, content_type, size }      (teacher, own class)
//   { kind: "submission", assignment_id, filename, content_type, size } (student, enrolled)
// Returns { url, fields, key, max_bytes }: POST a multipart form to `url` with every entry
// of `fields` followed by the file (last), then pass `key` as attachment_url / file_url when
// creating the assignment / submission.
uploadsRouter.post("/", async (req, res) => {
  if (!config.s3) throw new HttpError(503, "File uploads are not configured");
  const body = bodyOf(req);

  const kind = body.kind;
  if (kind !== "attachment" && kind !== "submission") {
    throw new HttpError(400, 'kind must be "attachment" or "submission"');
  }
  const filename = text(body.filename, "filename", { max: 255 });
  const contentType = text(body.content_type, "content_type", { max: 100 });
  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    throw new HttpError(400, "Unsupported file type. Allowed: PDF, plain text, PNG, JPEG, Word (.docx)");
  }
  if (!Number.isInteger(body.size) || body.size < 1) throw new HttpError(400, "size must be a positive integer (bytes)");
  if (body.size > MAX_FILE_BYTES) throw new HttpError(413, `File is too large (max ${MAX_FILE_BYTES / 1024 / 1024} MB)`);

  let key;
  if (kind === "attachment") {
    if (req.user.role !== "teacher") throw new HttpError(403, "Only teachers can attach files to assignments");
    const classId = uuid(body.class_id, "class_id");
    const owned = unwrap(
      await req.db.from("classes").select("id").eq("id", classId).eq("teacher_id", req.user.id).maybeSingle(),
    );
    if (!owned) throw new HttpError(404, "Class not found");
    key = newAttachmentKey(classId, req.user.id, filename);
  } else {
    if (req.user.role !== "student") throw new HttpError(403, "Only students can attach files to submissions");
    const assignmentId = uuid(body.assignment_id, "assignment_id");
    // RLS only lets a student read assignments in classes they're enrolled in.
    const visible = unwrap(await req.db.from("assignments").select("id").eq("id", assignmentId).maybeSingle());
    if (!visible) throw new HttpError(404, "Assignment not found");
    key = newSubmissionKey(assignmentId, req.user.id, filename);
  }

  const { url, fields } = await presignUpload({ key, contentType });
  res.status(201).json({ url, fields, key, max_bytes: MAX_FILE_BYTES });
});
