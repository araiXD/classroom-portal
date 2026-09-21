import { Router } from "express";
import { requireRole } from "../middleware/auth.js";
import { HttpError, unwrap } from "../errors.js";
import { attachmentKeyRe, fileKey, filenameOf } from "../files.js";
import { presignDownload } from "../s3.js";
import { bodyOf, isoDate, text, uuid } from "../validate.js";

export const assignmentsRouter = Router();

// Teacher: post an assignment to one of their classes (RLS rejects other classes).
// Body: { class_id, title, description?, due_date?, attachment_url? } where attachment_url is
// the S3 object key from POST /uploads (kind "attachment"), not a URL.
assignmentsRouter.post("/", requireRole("teacher"), async (req, res) => {
  const body = bodyOf(req);
  const classId = uuid(body.class_id, "class_id");
  const row = {
    class_id: classId,
    title: text(body.title, "title", { max: 200 }),
    description: text(body.description, "description", { max: 5000, required: false }),
    due_date: isoDate(body.due_date, "due_date"),
    attachment_url: fileKey(body.attachment_url, "attachment_url", attachmentKeyRe(classId, req.user.id)),
  };
  res.status(201).json(unwrap(await req.db.from("assignments").insert(row).select().single()));
});

// Assignments in classes the caller teaches or is enrolled in (RLS scopes this),
// optionally narrowed to one class with ?class_id=. A class you can't see just
// yields an empty list.
assignmentsRouter.get("/", async (req, res) => {
  let query = req.db
    .from("assignments")
    .select()
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });
  if (req.query.class_id !== undefined) query = query.eq("class_id", uuid(req.query.class_id, "class_id"));
  res.json(unwrap(await query));
});

// A short-lived download URL for the assignment's attachment. The assignment is read as the
// caller, so RLS decides who may see it (the class's teacher and enrolled students).
assignmentsRouter.get("/:id/attachment", async (req, res) => {
  const id = uuid(req.params.id, "id");
  const assignment = unwrap(
    await req.db.from("assignments").select("id, class_id, attachment_url").eq("id", id).maybeSingle(),
  );
  const key = assignment?.attachment_url;
  if (!key) throw new HttpError(404, "No attachment");
  // The column can be written directly through Supabase, so never sign a key we didn't mint.
  if (!attachmentKeyRe(assignment.class_id).test(key)) {
    console.warn(`Refusing to sign malformed attachment key on assignment ${id}`);
    throw new HttpError(404, "No attachment");
  }
  res.json({ url: await presignDownload(key), filename: filenameOf(key) });
});
