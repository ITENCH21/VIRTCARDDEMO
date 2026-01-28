import os
from urllib.parse import urlencode
import logging
from typing import Any, Callable, Iterable, Optional
import orjson
import httpx
import redis.asyncio as redis

from fastapi import FastAPI
from starlette.responses import JSONResponse
from sentry_sdk.integrations.asgi import SentryAsgiMiddleware
from starlette.requests import Request
from fastapi.openapi.utils import get_openapi

from common.nats_utils import AsyncNatsProducer, AsyncNatsConsumer

from app.db import register_db


logger = logging.getLogger(__name__)

DEFAULT_SCHEMA = dict(
    title="Backend API",
    version="1.0.0",
)

OpenAPIModifier = Callable[[dict[str, Any]], dict[str, Any]]


def create_app(
    routers,
    base_path="",
    description="",
    with_db=True,
    fastapi_init_kwargs: dict | None = None,
    debug: bool = False,
    redis=None,
    nats: dict | None = None,
    openapi_modifier: Optional[OpenAPIModifier] = None,
):
    if fastapi_init_kwargs is None:
        fastapi_init_kwargs = {}

    if base_path is None:
        openapi_url = None
    else:
        openapi_url = base_path + "/openapi.json"

    app = FastAPI(
        openapi_url=openapi_url,
        debug=debug,
        description=description,
        **fastapi_init_kwargs,
    )

    for router in routers:
        app.include_router(router)
    try:
        app.add_middleware(SentryAsgiMiddleware)
    except Exception as e:
        logger.error(e)

    # здесь дополняем/правим openapi
    # например, чтобы добавить webhooks
    openapi_schema = get_openapi(
        title=app.title,
        version=app.version,
        openapi_version=app.openapi_version,
        description=app.description,
        terms_of_service=app.terms_of_service,
        contact=app.contact,
        license_info=app.license_info,
        routes=app.routes,
        tags=app.openapi_tags,
        servers=app.servers,
    )
    if not openapi_modifier:
        app.openapi_schema = openapi_schema
    else:
        # openapi_modifier меняет схему
        app.openapi_schema = openapi_modifier(openapi_schema)

    @app.get("/openapi.json", include_in_schema=False)
    async def custom_swagger_ui_html():
        return app.openapi()

    @app.middleware("http")
    async def catch_exceptions_middleware(request: Request, call_next):
        try:
            return await call_next(request)
        # except BaseErrorMixin as err:
        #     logger.exception(err, exc_info=err.exc_info)
        #     return JSONResponse(
        #         {"detail": str(err)},
        #         status_code=err.status_code,
        #         headers=getattr(err, "headers", None),
        #     )
        except Exception as err:
            # you probably want some kind of logging here
            logger.exception(err)
            headers = {}
            return_data = {"detail": "Server Error"}
            if app.debug:
                return_data["detail"] = str(err)
                return_data["exc_type"] = str(type(err).__name__)
            return JSONResponse(
                return_data,
                status_code=500,
                headers=headers,
            )

    if with_db:
        register_db(app)

    if nats:
        register_nats(app, stream_name=nats["stream_name"], subjects=nats["subjects"])

    if redis:
        register_redis(app, redis)

    return app


def register_nats(app, stream_name, subjects) -> None:
    @app.on_event("startup")
    async def startup_nats():
        producer = AsyncNatsProducer(subjects=subjects, stream_name=stream_name)
        consumer = AsyncNatsConsumer(subjects=subjects, stream_name=stream_name)
        await consumer.connect()
        await producer.connect()
        app.state.producer = producer
        app.state.consumer = consumer

    @app.on_event("shutdown")
    async def close_nats() -> None:
        await app.state.producer.close()
        await app.state.consumer.close()


def register_redis(app, redis_db: Iterable) -> None:
    @app.on_event("startup")
    async def startup_session():
        app.state.redis_conn = {}
        for db in redis_db:
            conn = await redis.Redis(
                host=os.getenv("REDIS_HOST"),
                port=os.getenv("REDIS_PORT"),
                password=os.getenv("REDIS_PASSWORD"),
                db=int(os.getenv(db)),
            )
            app.state.redis_conn[db] = conn

    @app.on_event("shutdown")
    async def close_session() -> None:
        for db in app.state.redis_conn.values():
            await db.close()


async def http_request(
    url,
    method="get",
    params=None,
    data=None,
    json=None,
    headers=None,
    as_json=False,
    timeout=None,
):
    headers = headers or {}
    headers["X-Origin-Scheme"] = "https" if url.startswith("https://") else "http"
    if json is not None and data is None:
        headers["Content-Type"] = "application/json"
        data = orjson.dumps(json)
    if not url.startswith("http"):
        # UnsupportedProtocol: Request URL is missing an 'http://' or 'https://'...
        url = f"http://{url}"
    logger.info(
        "Start %r-%s request %r (%s)",
        headers["X-Origin-Scheme"],
        method,
        url,
        to_curl(method, url, params, data, headers),
    )
    http_proxy = os.getenv("HTTP_XNIGN_PROXY")
    http_client = httpx.AsyncClient(proxies={"all://": http_proxy}, timeout=20)
    # Need replace url-scheme for use as http-proxy, without https-tunnel
    #   through proxy
    req_kw = {}
    if timeout is not None:
        # Add 1sec for connect to xnign
        req_kw["timeout"] = timeout + 1.0
        headers["X-Xnign-Timeout"] = str(timeout)
    url = url.replace("https://", "http://")
    code = None
    try:
        response = await http_client.request(
            method,
            url,
            params=params,
            data=data,
            headers=headers,
            **req_kw,
        )
        code = response.status_code
        if as_json:
            result = response.json()
        else:
            result = response.text
    except Exception:
        logger.exception("Problem with request: %s", url)
        return 0, "http-client exception"
    return code, result


def to_curl(method, url, params, data, headers):
    try:
        cmd = ["curl", f"-X{method.upper()}"]
        if data is not None:
            if isinstance(data, dict):
                data = urlencode(data)
            elif isinstance(data, bytes):
                data = data.decode()
            cmd.append(f"--data '{data}'")
        if headers:
            for key, val in headers.items():
                cmd.append(f"-H '{key}: {val}'")
        query = f"?{urlencode(params)}" if params else ""
        cmd.append(f"{url}{query}")
        return " ".join(cmd)
    except Exception as e:
        return str(e)
