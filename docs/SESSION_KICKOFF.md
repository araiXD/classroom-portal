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
**Stages 1-6 are done and pushed. Stage 7 (deploy) is IN PROGRESS — see the checkpoint below.**

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
- [ ] Stage 7: Deploy (Vercel + Render) — IN PROGRESS. Full walkthrough written:
      `docs/DEPLOY.md`. Repo changes made and committed: `app.set("trust proxy", 1)` in
      `api/src/app.js` (Render sits behind one reverse proxy; needed so express-rate-limit
      doesn't error, even though the join-code limiter keys on user id, not IP), and the
      doc itself. `frontend/js/config.js` NOT YET edited for hostname-based URL switching —
      it needs the two Render service URLs first (can't be an env var, it's a static file
      Vercel ships as-is).
      * CHECKPOINT: waiting on the user to do Phase A (Vercel + Render accounts), Phase B
        (create the realtime Render service), and Phase C (create the API Render service),
        then report back the two resulting `*.onrender.com` URLs. Once given, the next
        session/turn edits config.js (hostname: localhost -> local ports, else -> the two
        Render URLs, wss:// for the websocket), commits it, and only then walks through
        Phase D (Vercel import), Phase E (wire the Vercel URL into CORS_ORIGIN, Supabase
        Auth URL Configuration, and S3 CORS), and Phase F (live test + troubleshooting table).
      * Same Supabase project and S3 bucket as local dev are reused for production — no new
        ones created.
      * User is generating a fresh production NOTIFY_SECRET themselves and entering it in
        both Render services (not generated by Claude).
      * Version pins for Render: NODE_VERSION=22.11.0 (api), PYTHON_VERSION=3.13.5 (realtime),
        set as dashboard env vars (not version-pin files, to avoid monorepo root-directory
        ambiguity about where Render looks for them).
      * CHECKPOINT RESOLVED: user did Phases A-C. Realtime URL
        https://classroom-portal-realtime.onrender.com, API URL
        https://classroom-portal-api.onrender.com, both /health OK. config.js updated with
        both (committed). User had NOT pushed the two earlier stage-7 commits before Render
        built, so the trust-proxy fix wasn't in that first deploy — bundled a reminder to
        push once (covers all 3 commits) and let auto-deploy redeploy both before Phase D.
      * User pushed, did Phase D. Vercel URL: https://classroom-portal-three.vercel.app
        (DEPLOY.md's placeholder examples updated to match). The bare "/" 404 on both Render
        services (Express's and FastAPI's default 404 JSON) is expected -- neither defines a
        route for it, only /health and the real API/WS routes.
      * NEXT: Phase E (user does this in Render/Supabase/AWS consoles) -- add CORS_ORIGIN on
        the API service, set Supabase Auth Site URL + Redirect URLs, update S3 CORS -- all
        using the real Vercel URL above, then Phase F (live test) from docs/DEPLOY.md.
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
