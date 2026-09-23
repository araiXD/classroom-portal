# Session Kickoff — Classroom Portal

## Context
Full spec is in `PROJECT_BRIEF.md` — read that first for the data model, stages, and non-goals.

## Repo
- GitHub: https://github.com/araiXD/classroom-portal.git
- Cloned locally at: /home/rie/Documents/Projects/classroom-portal

## Resuming a session
Open a fresh Claude Code session in the repo root, then check "Current status" below for the
stage checklist and continue from there.

## Working process
- Work stage by stage from `PROJECT_BRIEF.md`; never build everything at once.
- Each completed stage is tested in the browser before moving to the next.
- Commit after every completed stage, even small ones — in logical pieces (e.g. API, frontend,
  docs), one commit each; the user pushes.
- If a stage is tempting to gold-plate, stop and move to the next stage instead. Scope isn't
  added silently (new routes, columns, dependencies) — say what and why first.
- A real design decision (not a syntax or debugging issue) gets a question and a recommendation,
  not a guess.
- Any server started for testing is stopped before handing back, so ports aren't fought over.
- Each stage ends with exact steps to test it.

## Current status
**Stages 1-7 are done and live. Stage 8 (README) is in progress.**

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
      * A one-off test object from real-S3 verification may still need deleting from the bucket
        (`test-check/` prefix) — not explicitly confirmed.
- [x] Stage 7: Deploy (Vercel + Render) — LIVE, tested end-to-end in the browser (teacher
      created a class, posted an assignment with an attachment; student joined, submitted with a
      file). Frontend: https://classroom-portal-three.vercel.app · API:
      https://classroom-portal-api.onrender.com · realtime: https://classroom-portal-realtime.onrender.com.
      Same Supabase project and S3 bucket as local dev, reused for production. Full walkthrough
      in `docs/DEPLOY.md` (account setup, exact Render root dir/build/start commands and env
      vars per service, `frontend/js/config.js`'s hostname-based URL switch, wiring the Vercel
      URL into `CORS_ORIGIN`/Supabase Auth/S3 CORS, a troubleshooting table, and a Phase G for
      verifying the data directly in Supabase/S3/Render logs after a real test — done, data
      checked out).
      Also fixed in `api/src/app.js`: `app.set("trust proxy", 1)`, required behind Render's
      reverse proxy or `express-rate-limit` errors on every request.
- [ ] Stage 8: README — in progress. Adding a live-demo link, a Mermaid architecture diagram,
      stack rationale, and a feature-to-real-world-pattern table. Screenshots to follow once
      supplied.

This checklist is updated as work continues, so a later session can see exactly where things
left off.
