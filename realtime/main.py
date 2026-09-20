"""Realtime notification service.

- POST /notify   Express calls this (shared-secret header) after a submission.
- WS   /ws       Teacher browsers connect; the first message must authenticate them.

Auth is done by asking Supabase Auth who a token belongs to, using only the anon
key. This service never holds the service-role key or the JWT secret.
"""

import asyncio
import hmac
import json
import logging
import os
from contextlib import asynccontextmanager
from typing import Any
from uuid import UUID

import httpx
from fastapi import FastAPI, Header, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from registry import ConnectionRegistry


def _required(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"Missing required env var {name} (see realtime/.env.example)")
    return value


# Like the Express API: refuse to run with anything that bypasses RLS/JWT checks.
for forbidden in ("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_JWT_SECRET"):
    if os.environ.get(forbidden):
        raise RuntimeError(f"{forbidden} must not be set for the realtime service")

SUPABASE_URL = _required("SUPABASE_URL").rstrip("/")
SUPABASE_ANON_KEY = _required("SUPABASE_ANON_KEY")
NOTIFY_SECRET = _required("NOTIFY_SECRET")
if len(NOTIFY_SECRET) < 16:
    raise RuntimeError("NOTIFY_SECRET must be at least 16 characters")

AUTH_TIMEOUT_SECONDS = float(os.environ.get("AUTH_TIMEOUT_SECONDS", "10"))
MAX_TOKEN_LENGTH = 4096

# Close codes (4000-4999 are application-defined).
CLOSE_AUTH_FAILED = 4401
CLOSE_SERVER_ERROR = 1011

logger = logging.getLogger("uvicorn.error")
registry = ConnectionRegistry()


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with httpx.AsyncClient(timeout=5.0) as client:
        app.state.http = client
        yield


app = FastAPI(title="Classroom Portal realtime", lifespan=lifespan)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


# --- Express -> service ------------------------------------------------------


class NotifyRequest(BaseModel):
    teacher_id: UUID
    message: dict[str, Any]  # forwarded to the teacher's browsers as-is


@app.post("/notify")
async def notify(body: NotifyRequest, x_notify_secret: str = Header(default="")) -> dict[str, int]:
    if not hmac.compare_digest(x_notify_secret.encode(), NOTIFY_SECRET.encode()):
        raise HTTPException(status_code=401, detail="Invalid notify secret")
    delivered = await registry.send(str(body.teacher_id), body.message)
    return {"delivered": delivered}


# --- Browser -> service ------------------------------------------------------


async def verify_token(client: httpx.AsyncClient, token: str) -> str | None:
    """Ask Supabase Auth whose token this is. Returns the user id, or None if invalid."""
    response = await client.get(
        f"{SUPABASE_URL}/auth/v1/user",
        headers={"apikey": SUPABASE_ANON_KEY, "Authorization": f"Bearer {token}"},
    )
    if response.status_code == 200:
        return str(UUID(response.json()["id"]))  # normalize so it matches /notify's ids
    if response.status_code in (401, 403):
        return None
    raise RuntimeError(f"Supabase Auth returned {response.status_code}")


async def reject(websocket: WebSocket, message: str, code: int = CLOSE_AUTH_FAILED) -> None:
    await websocket.send_json({"type": "error", "message": message})
    await websocket.close(code=code)


async def authenticate(websocket: WebSocket) -> str | None:
    """Read the first message ({"type": "auth", "token": ...}) and verify it.

    Returns the user id, or None after rejecting (and closing) the socket.
    """
    try:
        raw = await asyncio.wait_for(websocket.receive_text(), AUTH_TIMEOUT_SECONDS)
    except asyncio.TimeoutError:
        await reject(websocket, "Authentication timed out")
        return None

    try:
        first = json.loads(raw)
        token = first["token"] if first["type"] == "auth" else None
    except (ValueError, KeyError, TypeError):
        token = None
    if not isinstance(token, str) or not 0 < len(token) <= MAX_TOKEN_LENGTH:
        await reject(websocket, 'First message must be {"type": "auth", "token": "<access token>"}')
        return None

    try:
        user_id = await verify_token(websocket.app.state.http, token)
    except (httpx.HTTPError, RuntimeError):
        await reject(websocket, "Authentication service unavailable", CLOSE_SERVER_ERROR)
        return None
    if user_id is None:
        await reject(websocket, "Invalid or expired token")
        return None
    return user_id


@app.websocket("/ws")
async def ws_endpoint(websocket: WebSocket) -> None:
    await websocket.accept()
    user_id = None
    try:
        user_id = await authenticate(websocket)
        if user_id is None:
            return
        registry.add(user_id, websocket)
        await websocket.send_json({"type": "ready"})
        # Nothing to receive from clients after auth; just wait for them to leave.
        while True:
            event = await websocket.receive()
            if event["type"] == "websocket.disconnect":
                break
    except WebSocketDisconnect:
        pass  # client left (possibly mid-handshake); cleanup is below
    except Exception:
        logger.exception("Unexpected error on /ws")
    finally:
        if user_id is not None:
            registry.remove(user_id, websocket)
