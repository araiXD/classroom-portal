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
| POST   | `/uploads`                        | any*    | ask to upload one file to S3 (see File uploads). *teacher for `kind: "attachment"`, student for `kind: "submission"` |
| GET    | `/assignments/:id/attachment`     | any     | `{ url, filename }`: a 60 s download URL for the assignment's attachment; 404 if you can't see the assignment or it has none |
| GET    | `/submissions/:id/file`           | any     | `{ url, filename }`: a 60 s download URL for a submission's file; 404 if you can't see the submission or it has none |

`POST /classes/join`, `GET /classes`, `GET /submissions` go beyond the brief's route list:
students need a way to enroll, and the Stage 4 dashboards need to list classes and submissions.
The two filters are optional so the student dashboard can load everything in one call each;
when given they're validated as UUIDs.

## File uploads

Files live in a **private** S3 bucket (`../docs/AWS_S3_SETUP.md`); the API only ever hands out
short-lived presigned URLs, and browsers talk to S3 directly, so file bytes never pass through Express.

1. `POST /uploads` with `{ kind, class_id | assignment_id, filename, content_type, size }`. The API
   checks, **as the caller**, that they may attach to that class (teacher, owns it) or assignment
   (student, RLS shows it to them, i.e. they're enrolled), then returns `{ url, fields, key, max_bytes }`.
2. The browser `POST`s a multipart form to `url` with every entry of `fields` followed by the file (last).
   S3 itself enforces the signed policy: size 1 byte to 5 MB, and exactly the declared `Content-Type`.
3. The browser sends `key` as `attachment_url` (`POST /assignments`) or `file_url` (`POST /submissions`).

**The `attachment_url` / `file_url` columns hold S3 object keys, not URLs**, always shaped
`attachments/<class id>/<teacher id>/<32 hex>/<name>` or `submissions/<assignment id>/<student id>/<32 hex>/<name>`.
The random part is unguessable and `<name>` is sanitized to `[A-Za-z0-9._-]` (max 100 chars, never starting
with `.`). Keys are checked on write (must sit under the caller's own prefix, so nobody can point a row at
someone else's file) and **again before signing a download**, because RLS lets a signed-in user write those
columns straight to Supabase without going through Express. Downloads are signed only after reading the row as
the caller, so RLS decides who may see a file, and they force `Content-Disposition: attachment`.

Guardrails live in `src/files.js`: max 5 MB; PDF, plain text, PNG, JPEG, or Word `.docx`. Without `S3_BUCKET`
in `api/.env` the file routes answer 503 and everything else works. The AWS credentials are read only from
`api/.env` and passed to the S3 client explicitly (no fallback to `~/.aws`).

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
