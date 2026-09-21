import { Router } from "express";
import { requireRole } from "../middleware/auth.js";
import { HttpError, unwrap } from "../errors.js";
import { notifySubmission } from "../notify.js";
import { fileKey, filenameOf, submissionKeyRe } from "../files.js";
import { presignDownload } from "../s3.js";
import { bodyOf, text, uuid } from "../validate.js";

export const submissionsRouter = Router();

// Student: submit (or replace their submission) for an assignment in a class they're
// enrolled in. Body: { assignment_id, content?, file_url? } — at least one of the two, where
// file_url is the S3 object key from POST /uploads (kind "submission"), not a URL.
submissionsRouter.post("/", requireRole("student"), async (req, res) => {
  const body = bodyOf(req);
  const assignment_id = uuid(body.assignment_id, "assignment_id");
  const content = text(body.content, "content", { max: 10000, required: false });
  const file_url = fileKey(body.file_url, "file_url", submissionKeyRe(assignment_id, req.user.id));
  if (content === null && file_url === null) throw new HttpError(400, "content or file_url is required");

  // One submission per student per assignment: resubmitting replaces it.
  const submission = unwrap(
    await req.db
      .from("submissions")
      .upsert(
        { assignment_id, student_id: req.user.id, content, file_url, submitted_at: new Date().toISOString() },
        { onConflict: "assignment_id,student_id" },
      )
      .select()
      .single(),
  );
  notifySubmission(req.db, req.user, submission); // fire-and-forget; never affects the response
  res.status(201).json(submission);
});

// Teacher: submissions to assignments in their classes, with the student's name.
// Student: just their own. RLS scopes both; ?assignment_id= narrows to one assignment.
submissionsRouter.get("/", async (req, res) => {
  let query = req.db
    .from("submissions")
    .select("*, student:profiles(full_name)")
    .order("submitted_at", { ascending: false });
  if (req.query.assignment_id !== undefined) {
    query = query.eq("assignment_id", uuid(req.query.assignment_id, "assignment_id"));
  }
  res.json(unwrap(await query));
});

// A short-lived download URL for a submission's file. The submission is read as the caller,
// so RLS decides who may see it (its student, and the class's teacher).
submissionsRouter.get("/:id/file", async (req, res) => {
  const id = uuid(req.params.id, "id");
  const submission = unwrap(
    await req.db.from("submissions").select("id, assignment_id, student_id, file_url").eq("id", id).maybeSingle(),
  );
  const key = submission?.file_url;
  if (!key) throw new HttpError(404, "No file");
  // The column can be written directly through Supabase, so never sign a key we didn't mint
  // for exactly this assignment and student.
  if (!submissionKeyRe(submission.assignment_id, submission.student_id).test(key)) {
    console.warn(`Refusing to sign malformed file key on submission ${id}`);
    throw new HttpError(404, "No file");
  }
  res.json({ url: await presignDownload(key), filename: filenameOf(key) });
});
