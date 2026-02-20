import json
import uuid

from pywebpush import WebPushException, webpush
from sqlalchemy import select

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.push_subscription import PushSubscription


async def send_push_to_user(user_id: uuid.UUID, title: str, message: str) -> int:
    """Send push notification to all subscriptions for a user. Returns count sent."""
    if not settings.vapid_private_key:
        return 0

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(PushSubscription).where(PushSubscription.user_id == user_id)
        )
        subscriptions = result.scalars().all()

    sent = 0
    for sub in subscriptions:
        subscription_info = {
            "endpoint": sub.endpoint,
            "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
        }
        payload = json.dumps({"title": title, "body": message, "icon": "/icons/icon-192x192.png"})
        try:
            webpush(
                subscription_info=subscription_info,
                data=payload,
                vapid_private_key=settings.vapid_private_key,
                vapid_claims={"sub": f"mailto:{settings.vapid_contact_email}"},
            )
            sent += 1
        except WebPushException:
            pass
    return sent
