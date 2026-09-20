import asyncio
from typing import Any

from fastapi import WebSocket


class ConnectionRegistry:
    """Open WebSockets keyed by user id (several tabs per user are fine).

    In memory only: it lives in this process, so it's empty after a restart
    (clients reconnect) and isn't shared if you run more than one instance.
    """

    def __init__(self) -> None:
        self._sockets: dict[str, set[WebSocket]] = {}

    def add(self, user_id: str, websocket: WebSocket) -> None:
        self._sockets.setdefault(user_id, set()).add(websocket)

    def remove(self, user_id: str, websocket: WebSocket) -> None:
        sockets = self._sockets.get(user_id)
        if sockets is None:
            return
        sockets.discard(websocket)
        if not sockets:
            del self._sockets[user_id]

    def count(self, user_id: str) -> int:
        return len(self._sockets.get(user_id, ()))

    async def send(self, user_id: str, message: dict[str, Any]) -> int:
        """Send to every open socket of this user. Returns how many were reached."""
        sockets = list(self._sockets.get(user_id, ()))

        async def send_one(websocket: WebSocket) -> bool:
            try:
                await websocket.send_json(message)
                return True
            except Exception:
                # Peer went away mid-send; drop it so we don't keep trying.
                self.remove(user_id, websocket)
                return False

        results = await asyncio.gather(*(send_one(ws) for ws in sockets))
        return sum(results)
