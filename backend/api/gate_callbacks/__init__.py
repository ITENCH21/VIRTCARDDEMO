"""
Gate Callbacks API — универсальный приёмник вебхуков от платёжных гейтов.

Маршрутизация по пути: POST /callback/{gate_code}
Какие гейты принимают коллбэки — определяется через env CALL_GATES=yeezypay,stripe,...

Сервис:
1. Валидирует gate_code по списку из CALL_GATES
2. Публикует raw payload в NATS на топик {gate_code}_callback (в gates_stream)
3. Всегда возвращает 200 OK (идемпотентность)

Бизнес-логика обработки — на стороне каждого гейта (YeezyPayMicroservice и т.д.).
"""

import os
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Request
from starlette.responses import JSONResponse

from api.base import create_app

logger = logging.getLogger(__name__)


# ── Конфигурация ─────────────────────────────────────────


def _parse_call_gates() -> set[str]:
    """Читает CALL_GATES из env, возвращает set кодов гейтов."""
    raw = os.getenv("CALL_GATES", "")
    gates = {g.strip().lower() for g in raw.split(",") if g.strip()}
    if gates:
        logger.info("CALL_GATES configured: %s", gates)
    else:
        logger.warning("CALL_GATES env is empty — no gates will accept callbacks")
    return gates


CALL_GATES: set[str] = _parse_call_gates()


def _callback_subjects() -> list[str]:
    """Генерирует список NATS-subjects для всех callback-гейтов."""
    return [f"{gate}_callback" for gate in sorted(CALL_GATES)]


# ── Router ───────────────────────────────────────────────

router = APIRouter(tags=["gate-callbacks"])


@router.post("/callback/{gate_code}")
async def receive_callback(gate_code: str, request: Request):
    """Принимает webhook от платёжного гейта и публикует в NATS.

    Путь определяет гейт: POST /callback/yeezypay → NATS yeezypay_callback.
    Всегда возвращает 200 OK.
    """
    gate_code_lower = gate_code.strip().lower()

    # 1. Проверяем, что гейт разрешён
    if gate_code_lower not in CALL_GATES:
        logger.warning(
            "Callback for unknown gate '%s' (allowed: %s)",
            gate_code,
            CALL_GATES,
        )
        return JSONResponse(
            {"status": "error", "detail": f"Gate '{gate_code}' not configured"},
            status_code=404,
        )

    # 2. Читаем raw body
    try:
        payload = await request.json()
    except Exception:
        logger.warning("Callback for '%s': invalid JSON body", gate_code)
        return JSONResponse(
            {"status": "error", "detail": "Invalid JSON body"},
            status_code=200,  # 200 чтобы гейт не ретраил
        )

    logger.info(
        "Received callback for gate '%s': %r",
        gate_code_lower,
        payload,
    )

    # 3. Публикуем в NATS
    topic = f"{gate_code_lower}_callback"
    message = {
        "gate_code": gate_code_lower,
        "payload": payload,
        "received_at": datetime.now(timezone.utc).isoformat(),
    }

    try:
        producer = request.app.state.producer
        if producer:
            await producer.publish(topic, message)
            logger.info("Published callback to NATS: %s", topic)
        else:
            logger.error("NATS producer not available, message lost!")
    except Exception:
        logger.exception("Failed to publish callback to NATS: %s", topic)

    return JSONResponse(
        {
            "status": "ok",
            "gate": gate_code_lower,
        },
        status_code=200,
    )


@router.get("/callback/health")
async def health():
    """Health-check эндпоинт."""
    return {
        "status": "ok",
        "service": "gate-callbacks",
        "configured_gates": sorted(CALL_GATES),
    }


# ── FastAPI App ──────────────────────────────────────────

routers = [router]

subjects = _callback_subjects()

settings = {
    "fastapi_init_kwargs": {
        "title": "Gate Callbacks API",
    },
    "nats": (
        {
            "stream_name": "gates_stream",
            "subjects": subjects,
        }
        if subjects
        else None
    ),
    "debug": os.getenv("DEBUG", "").lower() in ("enable", "true", "1"),
    "base_path": "/callback",
}

app = create_app(routers, **settings)
