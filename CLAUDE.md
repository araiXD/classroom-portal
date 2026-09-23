# Classroom Portal

A small classroom-management demo (teachers post assignments, students submit, teachers get a live
notification) built to mirror a real EdTech stack. **Read `docs/SESSION_KICKOFF.md` first**: its checklist
says which stage we're on and where the last session stopped; keep it updated. The spec, data model,
stages and non-goals are in `docs/PROJECT_BRIEF.md`. Don't copy either one here. Background/motivation
that isn't useful to a reader of the repo may be in `NOTES.local.md` at the repo root (git-ignored, so
it may not exist in every checkout) — check it if it seems relevant to a decision.

Stack: vanilla JS frontend, Express API, Supabase (Postgres + Auth + RLS), FastAPI websocket service,
private S3 bucket. Don't propose swapping it unless something is actually broken.

## Running it
Three processes, each in its own terminal (the user runs fish; Node 22+, Python venv in `realtime/.venv`):

```sh
cd api && npm run dev                                                    # API       :3000
cd realtime && .venv/bin/uvicorn main:app --port 8001 --env-file .env    # realtime  :8001
cd frontend && python3 -m http.server 8000                               # frontend  :8000
```

Each service has its own git-ignored `.env` (copy from its `.env.example`). Schema changes are SQL files in
`supabase/migrations/`, applied by hand in the Supabase SQL editor, in filename order. There is no committed
test suite; verify with throwaway scripts (see security rules). Stop by PID: `pkill -f` matches its own shell.

## Working process
See `docs/SESSION_KICKOFF.md`'s "Working process" section — kept there as the single copy so it
never drifts out of sync with this file.

## Security rules
- Never print or commit `.env` contents. Check presence with `grep -c '^NAME=.' file`, never `cat`.
  Scrub anything that might echo keys (AWS error bodies do).
- No service-role key in the API or the realtime service (both refuse to start with one), and no
  JWT secret in realtime. The API acts as the caller with their JWT, so RLS is the access control.
- AWS credentials live only in `api/.env`. The bucket stays private; files move by presigned URL.
- `attachment_url` / `file_url` hold S3 keys that clients can write directly: never trust them, and
  validate before signing.
- Don't sign up accounts or write test data in the user's Supabase project unless they say so; if
  they do, list everything created plus cleanup SQL, and note that "Confirm email" may be off.
- Keep test scripts out of the repo (use the scratchpad); the user will decide about tests at the end.
- Every shortcut or deliberate limitation goes in the README's **Known simplifications** section.
