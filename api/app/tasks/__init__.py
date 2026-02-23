import asyncio
import uuid

from app.tasks.celery import celery_app


@celery_app.task(
    name="app.tasks.check_budget_alerts_task",
    autoretry_for=(Exception,),
    max_retries=3,
    default_retry_delay=10,
)
def check_budget_alerts_task(user_id: str) -> None:
    from app.services.budget_alerts import check_budget_alerts
    from app.core.database import AsyncSessionLocal

    async def _run() -> None:
        async with AsyncSessionLocal() as db:
            await check_budget_alerts(db, uuid.UUID(user_id))

    asyncio.run(_run())
