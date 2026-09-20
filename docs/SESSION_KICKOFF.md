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
- [x] Stage 1: Repo + Supabase setup — migration applied and RLS verified by user
- [x] Stage 2: Auth + roles — signup trigger creates profiles row; login/signup page
      and minimal dashboard tested by user
- [x] Stage 3: Express API — built, migration 3 (join codes) applied, 60/60 e2e checks pass
      against the real Supabase project (roles, RLS isolation, join codes, rate limit).
      Decisions: join codes for enrollment; per-request client with caller's JWT (no
      service-role key in API); added GET /classes, GET /submissions, POST /classes/join.
      * TEST DATA STILL IN THE DATABASE awaiting cleanup: two sets of throwaway accounts
        (`test-{teacher,teacher2,student,outsider}@example.com` and the same with `-r2`),
        their profiles, and the classes/enrollments/assignments/submissions they created.
        Cleanup SQL (cascades to everything):
        `delete from auth.users where email like 'test-%@example.com';`
      * "Confirm email" in Supabase Auth was turned off for testing — turn it back on
        after cleanup.
- [ ] Stage 4: Frontend dashboards
- [ ] Stage 5: Python websocket server
- [ ] Stage 6: S3 file upload
- [ ] Stage 7: Deploy (Vercel + Render)
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
