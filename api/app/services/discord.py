import httpx
from app.core.config import settings


async def send_discord_notification(
    title: str,
    message: str,
    color: int = 0x5865F2,
) -> None:
    """Send a notification to Discord webhook. Silently skipped if URL not configured."""
    if not settings.discord_webhook_url:
        return
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(
                settings.discord_webhook_url,
                json={
                    "embeds": [
                        {
                            "title": title,
                            "description": message,
                            "color": color,
                        }
                    ]
                },
            )
    except Exception:
        pass  # Never let Discord failure break the app
