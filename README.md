# classroom-portal
Classroom portal — vanilla JS/Express/Supabase/Python WebSockets, deployed on Vercel + Render.

## Layout
- `frontend/` — vanilla JS/HTML/CSS (Vercel)
- `api/` — Express accounts/API service (Render)
- `realtime/` — Python websocket service (Render)
- `supabase/` — SQL migrations and schema notes
- `docs/` — project brief and session notes

## Run the API locally
See [`api/README.md`](api/README.md).

## Run the frontend locally
```sh
cd frontend && python3 -m http.server 8000   # then open http://localhost:8000
```

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
