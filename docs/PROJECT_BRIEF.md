# Classroom Portal — Project Brief

## Goal
A small classroom management demo showing full-stack ownership, built to mirror a
real EdTech job's stack: vanilla JS/HTML/CSS frontend, Express accounts service,
Supabase (Postgres + Auth) database, Python websocket server for real-time
notifications, deployed on Vercel + Render.

## Core user flow (the one thing that must fully work)
1. Teacher logs in, creates a class, posts an assignment.
2. Student logs in, sees the assignment on their dashboard, submits it.
3. Teacher's dashboard gets a **live** notification (via websocket) the moment the
   student submits — no page refresh.

Everything else is secondary. Get this flow working end-to-end before adding polish.

## Stack
- **Frontend:** vanilla JS, HTML, CSS. No framework. Fetch API for HTTP, native
  WebSocket API for the live feed.
- **Accounts/API service:** Express (Node.js). Handles auth-adjacent routes,
  CRUD for classes/assignments/submissions, role-checking middleware.
- **Database/Auth:** Supabase (Postgres). Use Supabase Auth for signup/login;
  store role (`teacher` / `student`) and profile data in a `profiles` table.
- **Real-time service:** Python (`websockets` or FastAPI + websockets). Separate
  small service. Express (or the frontend directly) notifies it when a submission
  is created; it pushes to any connected teacher clients.
- **File storage:** AWS S3 (free tier) for assignment attachments/submission files.
- **Hosting:** frontend on Vercel; Express service and Python service as two
  separate services on Render.

## Data model (Supabase/Postgres)
- `profiles` — id (uuid, matches auth.users), full_name, role (`teacher`|`student`)
- `classes` — id, name, teacher_id (fk → profiles)
- `enrollments` — id, class_id (fk), student_id (fk)
- `assignments` — id, class_id (fk), title, description, due_date, attachment_url
- `submissions` — id, assignment_id (fk), student_id (fk), content or file_url,
  submitted_at

## Stages (do these in order, one at a time, commit after each)
1. **Repo + Supabase setup.** Init git repo. Create Supabase project. Create the
   five tables above with foreign keys. Enable Row Level Security: teachers can
   only read/write their own classes; students can only read classes they're
   enrolled in and write their own submissions.
2. **Auth + roles.** Supabase Auth signup/login wired into the frontend. On
   signup, write a `profiles` row with the chosen role.
3. **Express API.** Routes: `POST /classes`, `GET /classes/:id`,
   `POST /assignments`, `GET /assignments?class_id=`, `POST /submissions`.
   Middleware that checks the caller's role/ownership via Supabase before
   allowing writes.
4. **Frontend dashboards.** Teacher view: create class, post assignment, list
   submissions. Student view: see assignments, submit.
5. **Python websocket server.** On new submission (Express calls it, or it
   polls/subscribes to Supabase changes), push a message to connected teacher
   clients. Frontend opens a WebSocket connection and shows a live toast/badge.
6. **S3 file upload.** Wire assignment attachments and/or submission files to
   S3 (presigned URL pattern is simplest from a static frontend).
7. **Deploy.** Vercel for the frontend; Render for Express and the Python
   service (two separate Render services). Set environment variables on both.
8. **README.** Architecture diagram (can be a simple box diagram), stack
   rationale, screenshots, and a note on what maps to which real-world EdTech
   feature (role-based permissions, live notifications, file storage, etc.).

## Explicit non-goals for this weekend
Do not build: billing/subscriptions, email notifications, grading, parent
accounts, or multi-school support. If a stage is tempting to gold-plate, stop
and move to the next stage instead — a finished small thing beats an unfinished
big one.
