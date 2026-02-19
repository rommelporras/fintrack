from app.tasks.celery import celery_app


@celery_app.task(name="app.tasks.notifications.check_statement_due_dates")
def check_statement_due_dates() -> None:
    """Daily task: notify users about statements due in 7 or 1 day."""
    import asyncio
    asyncio.run(_async_check_statements())


async def _async_check_statements() -> None:
    from datetime import date, timedelta
    from sqlalchemy import select, func, cast, Date
    from app.core.database import AsyncSessionLocal
    from app.models.statement import Statement
    from app.models.credit_card import CreditCard
    from app.models.notification import Notification, NotificationType
    from app.services.discord import send_discord_notification

    today = date.today()
    target_days = [7, 1]

    async with AsyncSessionLocal() as db:
        for days in target_days:
            target_date = today + timedelta(days=days)

            result = await db.execute(
                select(Statement, CreditCard)
                .join(CreditCard, Statement.credit_card_id == CreditCard.id)
                .where(
                    Statement.due_date == target_date,
                    Statement.is_paid == False,  # noqa: E712
                )
            )
            rows = result.all()

            for stmt, cc in rows:
                # Dedup: skip if already notified today for this statement+days
                # Use DB-side date cast to avoid Python local-date vs UTC mismatch
                existing = await db.execute(
                    select(Notification).where(
                        Notification.type == NotificationType.statement_due,
                        Notification.metadata_["statement_id"].astext == str(stmt.id),
                        Notification.metadata_["days"].astext == str(days),
                        cast(Notification.created_at, Date) == func.current_date(),
                    )
                )
                if existing.scalar_one_or_none():
                    continue

                label = "Tomorrow" if days == 1 else f"in {days} Days"
                title = f"Statement Due {label}"
                amount = float(stmt.total_amount or 0)
                message = (
                    f"Your credit card statement (₱{amount:,.2f}) "
                    f"is due on {stmt.due_date}."
                )
                n = Notification(
                    user_id=cc.user_id,
                    type=NotificationType.statement_due,
                    title=title,
                    message=message,
                    metadata_={"statement_id": str(stmt.id), "days": days},
                )
                db.add(n)
                await db.commit()
                await send_discord_notification(title, message)
