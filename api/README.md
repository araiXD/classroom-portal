# API (Express)

Runs as the calling user: each request builds a Supabase client from the caller's JWT, so
Postgres RLS (see `../supabase/`) is the source of truth for access. The middleware adds
clean 401/403 responses on top. **No service-role key** — the server refuses to start if
`SUPABASE_SERVICE_ROLE_KEY` is set.

## Run

```sh
cd api
cp .env.example .env   # fill in SUPABASE_URL and SUPABASE_ANON_KEY
npm install
npm run dev            # http://localhost:3000  (npm start for no file watching)
```

Requires Node 22+ (uses `--env-file`).

## Routes

All routes except `/health` need `Authorization: Bearer <supabase access token>`.
Errors are `{ "error": "message" }`.

| Method | Path                              | Who     | Notes                                                        |
|--------|-----------------------------------|---------|--------------------------------------------------------------|
| GET    | `/health`                         | anyone  |                                                              |
| POST   | `/classes`                        | teacher | `{ name }` → 201, includes the class's `join_code`           |
| GET    | `/classes`                        | any     | teacher: own classes; student: enrolled classes              |
| POST   | `/classes/join`                   | student | `{ code }` → enrolls the caller. Failed attempts rate-limited (10 / 15 min / user) |
| GET    | `/classes/:id`                    | any     | 404 if you can't see it                                      |
| POST   | `/assignments`                    | teacher | `{ class_id, title, description?, due_date?, attachment_url? }` → 201; 403 if not your class |
| GET    | `/assignments[?class_id=]`        | any     | all assignments in your classes; `class_id` narrows to one (a class you can't see gives an empty list) |
| POST   | `/submissions`                    | student | `{ assignment_id, content?, file_url? }` (at least one) → 201; replaces your earlier submission; 403 if not enrolled. Also pushes a live notification to the class's teacher (see below) |
| GET    | `/submissions[?assignment_id=]`   | any     | teacher: submissions in your classes (with `student.full_name`); student: only your own; `assignment_id` narrows to one assignment |

`POST /classes/join`, `GET /classes`, `GET /submissions` go beyond the brief's route list:
students need a way to enroll, and the Stage 4 dashboards need to list classes and submissions.
The two filters are optional so the student dashboard can load everything in one call each;
when given they're validated as UUIDs.

## Live notifications

After a submission is saved, the API tells the realtime service (`../realtime/`) to push a
notification to the class's teacher: it looks up the assignment's class and teacher as the
student (RLS allows it, since they're enrolled), then `POST`s to `$REALTIME_URL/notify` with
the `X-Notify-Secret` header. This is fire-and-forget with a 3 s timeout: the response
doesn't wait for it, and if the realtime service is down or slow the failure is only logged
(`Live notification not sent: ...`). Set `REALTIME_URL` and `NOTIFY_SECRET` in `api/.env`;
without `REALTIME_URL` notifications are simply off.

## Getting a token to try it with curl

```sh
curl -s "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $SUPABASE_ANON_KEY" -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"..."}'   # → access_token
curl -s localhost:3000/classes -H "Authorization: Bearer $ACCESS_TOKEN"
```

Tokens expire after an hour by default.
