# Realtime service (FastAPI)

Pushes a live notification to a teacher's open dashboard when a student submits. One
process serves both the WebSocket and the endpoint Express calls.

```
student submits ─► Express POST /submissions ─► saves it (RLS) ─► POST /notify ─► this service
                                                                                      │
teacher's browser ◄──────────── WebSocket /ws (authenticated) ◄───────────────────────┘
```

## Run

```sh
cd realtime
python3 -m venv .venv                 # first time only
.venv/bin/pip install -r requirements.txt
cp .env.example .env                  # fill in; NOTIFY_SECRET must match api/.env
.venv/bin/uvicorn main:app --port 8001 --env-file .env
```

Add `--reload` while developing. Generate a secret with
`python3 -c "import secrets; print(secrets.token_urlsafe(32))"`.

## Endpoints

- `GET /health`
- `POST /notify` — called by Express, not browsers. Header `X-Notify-Secret` must match
  `NOTIFY_SECRET` (else 401). Body: `{ "teacher_id": "<uuid>", "message": { ... } }`. The
  message is forwarded as-is to every open connection of that teacher (several tabs are
  fine). Returns `{ "delivered": <number of connections reached> }`; 0 just means the
  teacher isn't connected.
- `WS /ws` — the first message must be `{"type": "auth", "token": "<Supabase access token>"}`
  (sent as a message, not in the URL, so it can't end up in access logs). The service
  replies `{"type": "ready"}`, then pushes messages. Failures send
  `{"type": "error", "message": ...}` and close: `4401` for a missing/invalid token or no
  auth within 10 s, `1011` if Supabase Auth is unreachable.

## Auth

Tokens are verified by asking Supabase Auth (`GET /auth/v1/user`) with the **anon key
only**. The service never holds the service-role key or the JWT secret, and refuses to
start if `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_JWT_SECRET` is set. Any signed-in user
can connect, but a connection only ever receives messages addressed to its own user id.

## Limits

The registry of open connections is in memory (`registry.py`): a restart drops every
connection (the frontend reconnects by itself) and it isn't shared across instances.
Nothing is queued for teachers who are offline. See "Known simplifications" in the root
README.
