"""
FastAPI dependencies for WebApp API.
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from models.models import Client
from api.webapp.auth import decode_token

security = HTTPBearer()


async def get_current_client(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> Client:
    """Parse Authorization: Bearer <token>, validate JWT, return Client."""
    payload = decode_token(credentials.credentials)
    if payload is None or payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    client_id = payload.get("sub")
    if not client_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    try:
        client = await Client.get(pk=client_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Client not found",
        )

    return client
