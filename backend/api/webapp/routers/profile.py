"""Profile router — client profile CRUD."""

from fastapi import APIRouter, Depends

from models.models import Client
from api.webapp.deps import get_current_client
from api.webapp.schemas import ProfileResponse, ProfileUpdateRequest

router = APIRouter(prefix="/api/v1", tags=["profile"])


@router.get("/profile", response_model=ProfileResponse)
async def get_profile(client: Client = Depends(get_current_client)):
    """Get client profile."""
    return ProfileResponse(
        name=client.name or "",
        email=client.email or None,
        phone=client.phone or None,
        telegram_username=client.telegram_username or None,
    )


@router.patch("/profile", response_model=ProfileResponse)
async def update_profile(
    body: ProfileUpdateRequest,
    client: Client = Depends(get_current_client),
):
    """Update client profile fields."""
    update_data = body.dict(exclude_unset=True)

    if "name" in update_data and update_data["name"] is not None:
        client.name = update_data["name"]
    if "email" in update_data and update_data["email"] is not None:
        client.email = update_data["email"]
    if "phone" in update_data and update_data["phone"] is not None:
        client.phone = update_data["phone"]

    await client.save()

    return ProfileResponse(
        name=client.name or "",
        email=client.email or None,
        phone=client.phone or None,
        telegram_username=client.telegram_username or None,
    )
