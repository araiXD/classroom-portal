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
| GET    | `/assignments?class_id=`          | any     | empty list if the class isn't yours / you aren't enrolled    |
| POST   | `/submissions`                    | student | `{ assignment_id, content?, file_url? }` (at least one) → 201; replaces your earlier submission; 403 if not enrolled |
| GET    | `/submissions?assignment_id=`     | any     | teacher: all submissions (with `student.full_name`); student: own |

`POST /classes/join`, `GET /classes`, `GET /submissions` go beyond the brief's route list:
students need a way to enroll, and the Stage 4 dashboards need to list classes and submissions.

## Getting a token to try it with curl

```sh
curl -s "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $SUPABASE_ANON_KEY" -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"..."}'   # → access_token
curl -s localhost:3000/classes -H "Authorization: Bearer $ACCESS_TOKEN"
```

Tokens expire after an hour by default.
