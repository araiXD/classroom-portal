import { Router } from "express";
import { requireRole } from "../middleware/auth.js";
import { HttpError, unwrap } from "../errors.js";
import { bodyOf, httpUrl, text, uuid } from "../validate.js";

export const submissionsRouter = Router();

// Student: submit (or replace their submission) for an assignment in a class they're
// enrolled in. Body: { assignment_id, content?, file_url? } — at least one of the two.
submissionsRouter.post("/", requireRole("student"), async (req, res) => {
  const body = bodyOf(req);
  const assignment_id = uuid(body.assignment_id, "assignment_id");
  const content = text(body.content, "content", { max: 10000, required: false });
  const file_url = httpUrl(body.file_url, "file_url");
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
