import { Router } from "express";
import { requireRole } from "../middleware/auth.js";
import { unwrap } from "../errors.js";
import { bodyOf, httpUrl, isoDate, text, uuid } from "../validate.js";

export const assignmentsRouter = Router();

// Teacher: post an assignment to one of their classes (RLS rejects other classes).
// Body: { class_id, title, description?, due_date?, attachment_url? }
assignmentsRouter.post("/", requireRole("teacher"), async (req, res) => {
  const body = bodyOf(req);
  const row = {
    class_id: uuid(body.class_id, "class_id"),
    title: text(body.title, "title", { max: 200 }),
    description: text(body.description, "description", { max: 5000, required: false }),
    due_date: isoDate(body.due_date, "due_date"),
    attachment_url: httpUrl(body.attachment_url, "attachment_url"),
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
