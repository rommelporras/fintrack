import json
import uuid
from redis.asyncio import Redis
from app.core.config import settings


def _channel(user_id: uuid.UUID) -> str:
    return f"notifications:{user_id}"


async def get_redis() -> Redis:
    return Redis.from_url(settings.redis_url, decode_responses=True)


async def publish_notification(user_id: uuid.UUID, payload: dict) -> None:
    try:
        r = await get_redis()
        try:
            await r.publish(_channel(user_id), json.dumps(payload))
        finally:
            await r.aclose()
    except Exception:
        pass  # Non-critical: SSE clients will miss this event but DB has the notification

