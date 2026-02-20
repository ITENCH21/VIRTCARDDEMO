"""WebSocket router — real-time notifications for clients via Redis pub/sub."""

import asyncio
import json
import logging
import os

import redis.asyncio as aioredis
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from api.webapp.auth import decode_token

logger = logging.getLogger("ws")

router = APIRouter()

# client_id -> set of websockets
_connections: dict[str, set[WebSocket]] = {}

REDIS_HOST = os.getenv("REDIS_HOST", "redis")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD", "")
CHANNEL = "client_notifications"


async def _redis_listener():
    """Background task: listen Redis pub/sub and forward to WebSocket clients."""
    while True:
        try:
            conn = aioredis.Redis(
                host=REDIS_HOST,
                port=REDIS_PORT,
                password=REDIS_PASSWORD,
                decode_responses=True,
            )
            pubsub = conn.pubsub()
            await pubsub.subscribe(CHANNEL)
            logger.info("Redis pub/sub listener started on channel %s", CHANNEL)

            async for message in pubsub.listen():
                if message["type"] != "message":
                    continue
                try:
                    data = json.loads(message["data"])
                except (json.JSONDecodeError, TypeError):
                    continue

                client_id = data.get("client_id")
                if not client_id or client_id not in _connections:
                    continue

                payload = json.dumps(data)
                dead = set()
                for ws in _connections[client_id]:
                    try:
                        await ws.send_text(payload)
                    except Exception:
                        dead.add(ws)
                _connections[client_id] -= dead
                if not _connections[client_id]:
                    del _connections[client_id]

        except Exception:
            logger.exception("Redis pub/sub listener error, reconnecting in 5s")
            await asyncio.sleep(5)


_listener_task = None


def start_listener():
    """Start the Redis listener as a background task."""
    global _listener_task
    if _listener_task is None or _listener_task.done():
        _listener_task = asyncio.create_task(_redis_listener())


@router.websocket("/api/v1/ws")
async def websocket_endpoint(websocket: WebSocket):
    # Auth via query param: ?token=<jwt>
    token = websocket.query_params.get("token", "")
    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        await websocket.close(code=4001, reason="Unauthorized")
        return

    client_id = payload.get("sub")
    if not client_id:
        await websocket.close(code=4001, reason="Unauthorized")
        return

    await websocket.accept()

    # Ensure Redis listener is running
    start_listener()

    # Register connection
    if client_id not in _connections:
        _connections[client_id] = set()
    _connections[client_id].add(websocket)

    logger.info("WS connected: client=%s", client_id)

    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        _connections.get(client_id, set()).discard(websocket)
        if client_id in _connections and not _connections[client_id]:
            del _connections[client_id]
        logger.info("WS disconnected: client=%s", client_id)
