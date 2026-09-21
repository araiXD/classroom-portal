# Session Kickoff — Classroom Portal

## Context
I'm a CS grad (CSUF, May 2026) job-hunting for full-stack/EdTech developer roles.
I'm building this project to close specific keyword/skill gaps against a real job
posting, not just to have "a project." Full spec is in `PROJECT_BRIEF.md` —
read that first for the data model, stages, and non-goals.

## Why this project exists (don't relitigate scope — just build it)
Target job stack: vanilla JS/HTML/CSS, Express, Supabase, Python websockets,
deployed on Vercel/Render. My resume was missing: a SQL/Supabase database, any
cloud platform (AWS/Azure/GCP), and a fully solo-owned project. This build
closes all three in one go — don't suggest swapping the stack (e.g. "just use
React" or "skip Supabase for Firebase") unless something is actually broken.

## Repo
- GitHub: https://github.com/araiXD/classroom-portal.git
- Cloned locally at: /home/rie/Documents/Projects/classroom-portal

## How I want to work
- Go stage by stage from `PROJECT_BRIEF.md` — never "build the whole thing."
- After each stage: I run/test it myself before moving on.
- Commit after every completed stage, even small ones.
- If a stage is tempting to gold-plate, stop and move to the next stage instead.
- If you (Claude) hit a real design decision (not a syntax/debug issue), ask me
  directly rather than guessing — I'd rather answer a question than redo work.

## Current status
**Stages 1-6 are done and pushed. Stage 7 (deploy) is next and has NOT been started; wait for the
user to say go.** See the Stage 7 notes below before starting.

- [x] Stage 1: Repo + Supabase setup — migration applied and RLS verified by user
- [x] Stage 2: Auth + roles — signup trigger creates profiles row; login/signup page
      and minimal dashboard tested by user
- [x] Stage 3: Express API — built, migration 3 (join codes) applied, 60/60 e2e checks pass
      against the real Supabase project (roles, RLS isolation, join codes, rate limit).
      Decisions: join codes for enrollment; per-request client with caller's JWT (no
      service-role key in API); added GET /classes, GET /submissions, POST /classes/join.
      * Test accounts/data cleaned up and "Confirm email" re-enabled by user.
- [x] Stage 4: Frontend dashboards — tested by user in the browser (teacher and student
      flows). `frontend/dashboard.html` swaps a teacher or student view by role
      (`js/teacher.js`, `js/student.js`, shared `js/api.js` + `js/dom.js`). API's
      `GET /assignments?class_id=` and `GET /submissions?assignment_id=` filters are now
      optional (RLS scopes the unfiltered lists) so the student dashboard loads in 3 calls.
      Teacher's submissions list was manual (Refresh) until Stage 5 made it live.
      (File attachments were deferred to Stage 6, where they became S3 keys with signed
      downloads instead of rendered links.)
- [x] Stage 5: Python websocket server — tested by user in two browser windows (toast,
      badges, auto-refresh, multi-tab, recovery after the service goes down). FastAPI service in
      `realtime/` (venv at `realtime/.venv`, gitignored): `POST /notify` (shared-secret header) +
      `WS /ws` (first message = Supabase access token, verified via Supabase Auth with the anon
      key only; no service-role key or JWT secret), in-memory registry keyed by teacher id
      (multi-tab). Express `notify.js` calls /notify fire-and-forget (3 s timeout, failures only
      logged). Frontend `js/live.js` (reconnect with backoff) + toasts/badges in `js/teacher.js`.
      Needs `REALTIME_URL` + `NOTIFY_SECRET` in api/.env and `NOTIFY_SECRET` in realtime/.env.
- [x] Stage 6: S3 file upload — tested by user in the browser (attachment upload, submission
      file upload, both downloads, refusals; bucket stays private) and against real S3 by a
      scripted check (19 checks: valid upload + download round trip; S3 itself rejects an oversize,
      empty, wrong-type, tampered-key or bad-signature upload; unsigned/altered download URLs get
      403; downloads forced to attachment; CORS allows only localhost:8000). Setup guide:
      `docs/AWS_S3_SETUP.md`. Express presigns: `POST /uploads` (shared for assignment
      attachments + submission files; presigned POST so S3 enforces a 5 MB cap and the exact
      content type), `GET /assignments/:id/attachment`, `GET /submissions/:id/file`. Private
      bucket, all public access blocked; AWS creds only in api/.env, passed explicitly to the
      client. Columns attachment_url / file_url hold S3 KEYS (validated on write and again
      before signing, since RLS lets clients write them directly). Frontend: `js/upload.js` +
      file pickers/download buttons in teacher.js and student.js. Resubmitting without a new
      file keeps the existing one.
      * LEFTOVER TEST OBJECT for the user to delete in the S3 console (the IAM user has no
        DeleteObject): `test-check/20260921061801-2397/valid/hello.pdf`
        (delete the whole `test-check/` prefix).
- [ ] Stage 7: Deploy (Vercel + Render) — NOT STARTED
      * The deployed WebSocket URL must be `wss://` (set `REALTIME_WS_URL` in
        `frontend/js/config.js`; a page served over https can't open plain `ws://`).
      * Render's free tier cold-starts services, so a push to a sleeping realtime service can hit
        Express's 3 s notify timeout and be missed (the submission is still saved).
- [ ] Stage 8: README

(Update this checklist as you go so a future session knows exactly where things
left off.)

## Other things worth knowing about me (only if relevant to a decision)
- Comfortable with Linux/dev tooling (dual-boot Arch background), so terminal-
  heavy workflows are fine.
- Prior related work: an RTX-sponsored capstone ML project, a team-built
  full-stack ordering platform (React/Express/MongoDB/Stripe), and ongoing
  maintenance of a live WooCommerce store — all already on my resume, no need
  to reference them unless directly useful for a pattern/decision here.

## First message to send in the new chat
"I'm starting Stage 1 of the Classroom Portal (see PROJECT_BRIEF.md and this
kickoff doc). Let's set up the Supabase schema and get the repo scaffolded."
