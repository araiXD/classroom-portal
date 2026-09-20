# classroom-portal
Classroom portal — vanilla JS/Express/Supabase/Python WebSockets, deployed on Vercel + Render.

## Layout
- `frontend/` — vanilla JS/HTML/CSS (Vercel)
- `api/` — Express accounts/API service (Render)
- `realtime/` — Python (FastAPI) websocket service that pushes live notifications (Render)
- `supabase/` — SQL migrations and schema notes
- `docs/` — project brief and session notes

## Run everything locally
Three processes, each in its own terminal:
```sh
cd api && npm run dev                                            # API          :3000  (see api/README.md)
cd realtime && .venv/bin/uvicorn main:app --port 8001 --env-file .env   # realtime :8001  (see realtime/README.md)
cd frontend && python3 -m http.server 8000                       # frontend     :8000
```
Then open http://localhost:8000. The realtime service is optional: without it everything
works except the teacher's live notifications.

The dashboards call the API at `API_URL` and the realtime service at `REALTIME_WS_URL`
(both in `frontend/js/config.js`). The API only accepts browser requests from
`http://localhost:8000` by default (`CORS_ORIGIN`).

## Known simplifications
Deliberate scope cuts for a demo, not oversights:

- **Anyone can pick "Teacher" at signup.** The brief has the user choose their role, so the signup
  trigger honors it. A real deployment would gate teacher accounts (invites, an allowlist, or
  admin approval).
- **Enrolled students can see the join code.** RLS lets a student read their class row, and the
  code is a column on it, so a student can pass it on. Google Classroom works the same way;
  rotating codes or hiding the column would tighten it.
- **The join rate limit lives in server memory.** Failed join attempts are capped per user, but
  the counter resets on restart and isn't shared between instances. Fine for one Render
  service; scaling out would need a shared store such as Redis.
- **No late-submission handling, and no deleting classes or assignments.** Grading and deadline
  enforcement are non-goals, so `due_date` is informational and late work is accepted
  unflagged. There are no delete routes or buttons (RLS would let a teacher delete their own
  classes and assignments, but nothing exposes it).
- **Live notifications use an in-memory registry and are best-effort.** The realtime service
  tracks connected teachers in a process-local dict, so a restart drops every connection (browsers
  reconnect on their own) and a second instance would split teachers between processes; scaling out
  needs a shared pub/sub such as Redis. Nothing is queued: if a teacher is offline, or the service is
  down when a student submits, that push is simply missed. The submission itself is always saved, and
  the dashboard's Refresh (or a reconnect) shows it.
- **The WebSocket token is only verified when the connection opens.** A tab left open past the
  token's expiry (about an hour) stays connected and keeps receiving pushes until it next
  reconnects, which authenticates with a fresh token. The stream only ever carries that teacher's
  own notifications, so re-checking mid-connection wasn't worth the complexity for a demo.
- **Resubmissions trigger the same toast as first submissions.** A submission is an upsert, so the
  API can't tell a new one from a replacement, and the teacher sees an identical notification for both.
