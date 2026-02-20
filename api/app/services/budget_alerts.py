import uuid
from datetime import date
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, extract
from app.models.budget import Budget
from app.models.transaction import Transaction
from app.models.notification import Notification, NotificationType
from app.services.discord import send_discord_notification
from app.services.pubsub import publish_notification


async def check_budget_alerts(db: AsyncSession, user_id: uuid.UUID) -> None:
    """Check all budgets for user and fire alerts if thresholds crossed.

    Called synchronously after every transaction write. Idempotent per month:
    at most one warning and one exceeded notification per budget per calendar month.
    """
    today = date.today()
    month_start = today.replace(day=1)

    budgets_result = await db.execute(
        select(Budget).where(Budget.user_id == user_id)
    )
    budgets = budgets_result.scalars().all()

    for budget in budgets:
        if budget.amount == 0:
            continue

        spent = await get_month_spending(db, user_id, budget, month_start)
        percent = float(spent / budget.amount * 100)

        if percent >= 100 and budget.alert_at_100:
            await _maybe_notify(
                db, user_id, budget, NotificationType.budget_exceeded, percent, spent
            )
        elif percent >= 80 and budget.alert_at_80:
            await _maybe_notify(
                db, user_id, budget, NotificationType.budget_warning, percent, spent
            )


async def get_month_spending(
    db: AsyncSession,
    user_id: uuid.UUID,
    budget: "Budget",
    month_start: date,
) -> Decimal:
    from app.models.transaction import TransactionType
    q = select(func.coalesce(func.sum(Transaction.amount), Decimal(0))).where(
        Transaction.user_id == user_id,
        Transaction.type == TransactionType.expense,
        Transaction.date >= month_start,
        extract("month", Transaction.date) == month_start.month,
        extract("year", Transaction.date) == month_start.year,
    )
    if budget.type == "category" and budget.category_id:
        q = q.where(Transaction.category_id == budget.category_id)
    elif budget.type == "account" and budget.account_id:
        q = q.where(Transaction.account_id == budget.account_id)
    result = await db.execute(q)
    value = result.scalar()
    return Decimal(value).quantize(Decimal("0.01")) if value is not None else Decimal("0.00")


async def _maybe_notify(
    db: AsyncSession,
    user_id: uuid.UUID,
    budget: Budget,
    notif_type: NotificationType,
    percent: float,
    spent: Decimal,
) -> None:
    """Create notification only if one doesn't already exist this month."""
    month_start = date.today().replace(day=1)
    existing = await db.execute(
        select(Notification).where(
            Notification.user_id == user_id,
            Notification.type == notif_type,
            Notification.metadata_["budget_id"].astext == str(budget.id),
            Notification.created_at >= month_start,
        )
    )
    if existing.scalar_one_or_none():
        return  # Already notified this month for this budget+type

    label = "category" if budget.type == "category" else "account"
    is_warning = notif_type == NotificationType.budget_warning
    title = f"Budget {'Warning' if is_warning else 'Exceeded'}"
    message = (
        f"You've spent {percent:.1f}% of your {label} budget "
        f"(₱{budget.amount:,.2f})."
    )
    n = Notification(
        user_id=user_id,
        type=notif_type,
        title=title,
        message=message,
        metadata_={"budget_id": str(budget.id), "percent": percent},
    )
    db.add(n)
    await db.commit()
    await send_discord_notification(title, message)
    await publish_notification(user_id, {"id": str(n.id), "type": notif_type.value, "title": title, "message": message})
