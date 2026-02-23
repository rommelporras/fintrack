import asyncio

from app.tasks.celery import celery_app


@celery_app.task(name="check-budget-alerts")
def check_budget_alerts_task(user_id: str) -> None:
    from app.services.budget_alerts import check_budget_alerts
    from app.core.database import AsyncSessionLocal
    import uuid

    async def _run() -> None:
        async with AsyncSessionLocal() as db:
            await check_budget_alerts(db, uuid.UUID(user_id))

    asyncio.run(_run())
