# Deploying (Stage 7)

Frontend on Vercel, the two backend services on Render, using the **same** Supabase project and
S3 bucket you've already been using — no new database or bucket. Nothing here needs a paid tier.

Do the phases **in this order** — later ones need URLs that only exist once an earlier one is done.
Two things only exist as committed files, not env vars, so they must be right *before* their first
deploy: `frontend/js/config.js` (no server to hand it env vars) needs the two Render URLs before
Vercel's first deploy.

## Phase A — accounts

1. [vercel.com](https://vercel.com) → sign in with GitHub → this also grants it repo access.
2. [render.com](https://render.com) → sign in with GitHub, same reason.

Both are free to sign up for; neither should need a card for what we're doing.

## Phase B — Render: realtime service first

The API needs the realtime service's URL, but not the other way round, so create this one first.

Render dashboard → **New +** → **Web Service** → pick `classroom-portal` (authorize the repo if asked)
→ it shows a config form:

| Field | Value |
|---|---|
| Name | `classroom-portal-realtime` (or your own — whatever you end up with, use *that* URL everywhere below) |
| Language/Runtime | Python 3 (Render should auto-detect this from `requirements.txt`) |
| Region | whichever's closest to you, or leave the default |
| Branch | `main` |
| Root Directory | `realtime` |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `uvicorn main:app --host 0.0.0.0 --port $PORT` |
| Instance Type | Free |

`$PORT` is Render's own env var — leave it exactly as `$PORT` in the command, don't hardcode 8001.

Before clicking create, open **Advanced** and add:

| Env var | Value | Secret |
|---|---|---|
| `SUPABASE_URL` | same value as your local `realtime/.env` | no |
| `SUPABASE_ANON_KEY` | same value as your local `realtime/.env` | no |
| `NOTIFY_SECRET` | your new production secret | **yes** |
| `PYTHON_VERSION` | `3.13.5` | no |

Do **not** add `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_JWT_SECRET` — `main.py` refuses to start if
either is present.

Also set the health check: **Advanced** → Health Check Path → `/health` (if you don't see this
during creation, it's under the service's **Settings** → **Health Checks** afterward).

Create the service. First deploy takes a few minutes (installing FastAPI/uvicorn). Once it's live,
**copy its URL** from the top of the service page — looks like
`https://classroom-portal-realtime.onrender.com`. **Write it down**, you need it twice below.

Sanity check once it's live: open `https://<that-url>/health` in a browser tab — expect `{"status":"ok"}`.

## Phase C — Render: API service

Same **New +** → **Web Service** → same repo.

| Field | Value |
|---|---|
| Name | `classroom-portal-api` |
| Language/Runtime | Node (auto-detected from `package.json`) |
| Region | same as the realtime service (not required, just tidy) |
| Branch | `main` |
| Root Directory | `api` |
| Build Command | `npm ci` |
| Start Command | `npm start` |
| Instance Type | Free |

Advanced → env vars:

| Env var | Value | Secret |
|---|---|---|
| `SUPABASE_URL` | same value as your local `api/.env` | no |
| `SUPABASE_ANON_KEY` | same value as your local `api/.env` | no |
| `REALTIME_URL` | the realtime URL from Phase B, e.g. `https://classroom-portal-realtime.onrender.com` | no |
| `NOTIFY_SECRET` | the **same** production secret you put on the realtime service | **yes** |
| `S3_BUCKET` | same value as your local `api/.env` | no |
| `AWS_REGION` | same value as your local `api/.env` | no |
| `AWS_ACCESS_KEY_ID` | same value as your local `api/.env` | **yes** |
| `AWS_SECRET_ACCESS_KEY` | same value as your local `api/.env` | **yes** |
| `NODE_VERSION` | `22.11.0` | no |

**Skip `CORS_ORIGIN` and `PORT` for now.** Without `CORS_ORIGIN` the app defaults to allowing
`http://localhost:8000`, which is harmless since nothing production will call it yet — we'll set the
real value in Phase E once the Vercel URL exists. Render sets `PORT` itself; the app already reads
`process.env.PORT`, so adding your own would just conflict.

Health Check Path: `/health`, same as Phase B.

Create it, wait for the first deploy, then **copy this URL too** — `https://classroom-portal-api.onrender.com`.
Sanity check: `https://<that-url>/health` → `{"status":"ok"}`.

## Checkpoint — stop and report back

**Before continuing to Phase D**, tell me the two URLs from Phases B and C. I'll edit
`frontend/js/config.js` to point at them and commit it (you push) — that file is static and ships
with the frontend build, so it has to be correct *before* the first Vercel deploy, not after.

The edit makes `config.js` choose by hostname:

```js
const isLocal = location.hostname === "localhost" || location.hostname === "127.0.0.1";
export const API_URL = isLocal ? "http://localhost:3000" : "https://classroom-portal-api.onrender.com";
export const REALTIME_WS_URL = isLocal ? "ws://localhost:8001/ws" : "wss://classroom-portal-realtime.onrender.com/ws";
```

Local dev (`python3 -m http.server 8000`) keeps working unchanged; only a real deployed hostname
gets the Render URLs. Note `wss://`, not `ws://` — a page served over `https://` can't open a plain
`ws://` connection, the browser blocks it.

## Phase D — Vercel: frontend

Once `config.js` is pushed with the real URLs:

Vercel dashboard → **Add New...** → **Project** → import `classroom-portal`.

| Field | Value |
|---|---|
| Framework Preset | **Other** |
| Root Directory | `frontend` (click Edit next to it to set this) |
| Build Command | leave empty |
| Output Directory | leave on its default; only override it to `.` if Vercel complains it can't find a `public` folder |
| Install Command | leave on its default (there's no `package.json` in `frontend/`, so it'll skip this) |
| Environment Variables | none — `config.js` is a plain committed file |

Deploy. You get a URL like `https://classroom-portal-three.vercel.app` — **write that down too**.

## Phase E — wire the frontend URL back into everything else

Now that the Vercel URL exists, three places need it.

**1. Render API service** → your `classroom-portal-api` service → **Environment** → add:

| Env var | Value |
|---|---|
| `CORS_ORIGIN` | `https://classroom-portal-three.vercel.app` (no trailing slash) |

Save — Render restarts the service (no rebuild needed, it's just an env var).

**2. Supabase** → your project → **Authentication** → **URL Configuration**:
- **Site URL**: `https://classroom-portal-three.vercel.app` — this is where a signup confirmation email's
  link points.
- **Redirect URLs**: add `https://classroom-portal-three.vercel.app/**`. If `http://localhost:8000/**`
  isn't already listed, add that too so local dev keeps working.

**3. S3 bucket** → **Permissions** → **CORS** → replace the rule with:

```json
[
  {
    "AllowedOrigins": ["http://localhost:8000", "https://classroom-portal-three.vercel.app"],
    "AllowedMethods": ["POST"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": [],
    "MaxAgeSeconds": 3000
  }
]
```

## Phase F — test the live site

Open `https://classroom-portal-three.vercel.app`.

1. **Log in** with one of your real accounts. A blank page or a console error here means Supabase
   URL/key or CORS is wrong — check the browser console first.
2. **Dashboard loads** (classes list, etc.) — confirms the frontend is reaching the API and
   `CORS_ORIGIN` is right.
3. **Live status line** should reach "● Live updates on" within a few seconds — confirms the `wss://`
   URL and `NOTIFY_SECRET` match between the two Render services. If it's Render's free tier and the
   realtime service had gone to sleep, the first connection can take up to ~50 s to wake it.
4. **Submit as a student, watch the teacher window** for the toast — confirms the full notify chain.
5. **Upload and download a file** in both roles — confirms the S3 CORS change and the API's AWS env vars.

### If something's wrong

| Symptom | Likely cause |
|---|---|
| Blank page / JS error in console | wrong Supabase URL or key in `config.js`, or a typo in the Render URLs |
| 401s in the console, or "Could not reach the API" | `API_URL` in `config.js` doesn't match the actual Render API URL |
| Requests blocked, console says CORS | `CORS_ORIGIN` on the API doesn't exactly match the Vercel URL (scheme, no trailing slash) |
| Live status stuck on "connecting…" | `REALTIME_WS_URL` isn't `wss://`, or the realtime service is asleep (free tier, wait ~50 s) — check the realtime service's logs in Render |
| Live status reaches "live" but no toast arrives | `NOTIFY_SECRET` doesn't match between the two Render services |
| Signup email links to `localhost` | Supabase's Site URL wasn't updated (Phase E, step 2) |
| Upload fails with a CORS message | the S3 bucket's CORS rule doesn't include the Vercel origin, or still says `http://` where it should say `https://` |

Render's free tier spins a service down after inactivity, so the *first* request after a quiet
period on either backend service can be slow (cold start) — that's expected, not a bug.

## Phase G — verify the data directly (optional, but worth doing once)

Phase F proves the site *behaves* correctly. This proves the *data* landed where it should —
worth doing once after the first real end-to-end test (a class created, a student enrolled, an
assignment with an attachment, a submission with a file).

**1. Supabase → SQL Editor** — one query walks the whole chain for your newest class:

```sql
select
  c.id as class_id, c.name as class, c.join_code,
  t.full_name as teacher,
  s.id as student_id, s.full_name as student,
  a.id as assignment_id, a.title as assignment, a.attachment_url,
  sub.content, sub.file_url, sub.submitted_at
from public.classes c
join public.profiles t on t.id = c.teacher_id
join public.enrollments e on e.class_id = c.id
join public.profiles s on s.id = e.student_id
join public.assignments a on a.class_id = c.id
left join public.submissions sub on sub.assignment_id = a.id and sub.student_id = s.id
order by c.created_at desc
limit 10;
```

Check: `attachment_url` and `file_url` are **S3 keys, not URLs** —
`attachments/<class_id>/<teacher_id>/<32 hex>/<filename>` and
`submissions/<assignment_id>/<student_id>/<32 hex>/<filename>` respectively. The `<class_id>` /
`<assignment_id>` / `<student_id>` segments should match that row's own `class_id`, `assignment_id`
and `student_id` columns exactly — that match is the whole point of the key-validation code in
`api/src/files.js`, so seeing it hold in production is a real check of that logic, not just a look.

(Table Editor works too if you'd rather click through `classes` / `enrollments` / `assignments` /
`submissions` than write SQL — the query above just puts every row of interest in one place.)

**2. S3 console → your bucket** — search/filter by the `attachments/<class_id>/` and
`submissions/<assignment_id>/<student_id>/` prefixes from the query above. Each should contain
exactly one object, named after the file you uploaded. Click one open and try its plain "Object URL"
directly — it should still deny you (`AccessDenied`); if it doesn't, something's wrong with the
bucket's public-access block.

While you're in the console: delete the leftover `test-check/` prefix from the earlier real-S3
check, if you haven't already (the IAM user has no `DeleteObject`, so only you can).

**3. Render → `classroom-portal-api` → Logs.** This service has no request-access logging (nothing
logs a line for a normal 2xx), so *the absence of anything alarming is the signal*: no
`"Live notification not sent: ..."` warning (would mean the call to the realtime service failed), no
`REALTIME_URL not set` or `S3_BUCKET not set` warnings at startup (would mean an env var is missing),
and no stack traces.

**4. Render → `classroom-portal-realtime` → Logs.** Unlike the API, uvicorn logs every request by
default. You should see lines like `"GET /ws HTTP/1.1" 101` (the teacher dashboard's websocket) and
`"POST /notify HTTP/1.1" 200 OK` (the API telling it about the submission) — no `500`s, no
tracebacks.

**5. Browser, if you haven't already:** click the attachment/file download buttons on the live site
for the ones you just uploaded — confirms the round trip (signed URL issued, S3 actually serves the
object) beyond just the upload succeeding.
