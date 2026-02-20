from datetime import date, timedelta

from dateutil.relativedelta import relativedelta
from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.models.notification import Notification, NotificationType
from app.models.recurring_transaction import RecurrenceFrequency, RecurringTransaction
from app.models.transaction import Transaction, TransactionSource
from app.services.pubsub import publish_notification
from app.services.web_push import send_push_to_user


def advance_date(current: date, freq: RecurrenceFrequency) -> date:
    match freq:
        case RecurrenceFrequency.daily:
            return current + timedelta(days=1)
        case RecurrenceFrequency.weekly:
            return current + timedelta(weeks=1)
        case RecurrenceFrequency.biweekly:
            return current + timedelta(weeks=2)
        case RecurrenceFrequency.monthly:
            return current + relativedelta(months=1)
        case RecurrenceFrequency.yearly:
            return current + relativedelta(years=1)


async def generate_recurring_transactions() -> int:
    today = date.today()
    count = 0
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(RecurringTransaction).where(
                RecurringTransaction.is_active == True,  # noqa: E712
                RecurringTransaction.next_due_date <= today,
            )
        )
        for rec in result.scalars().all():
            txn = Transaction(
                user_id=rec.user_id,
                account_id=rec.account_id,
                category_id=rec.category_id,
                amount=rec.amount,
                description=rec.description,
                type=rec.type,
                sub_type=rec.sub_type,
                date=rec.next_due_date,
                source=TransactionSource.recurring,
                recurring_id=rec.id,
                created_by=rec.user_id,
            )
            db.add(txn)
            await db.flush()

            n = Notification(
                user_id=rec.user_id,
                type=NotificationType.recurring_created,
                title="Recurring Transaction Created",
                message=f"\u20b1{rec.amount:,.2f} \u2014 {rec.description}",
                metadata_={"recurring_id": str(rec.id), "transaction_id": str(txn.id)},
            )
            db.add(n)

            rec.next_due_date = advance_date(rec.next_due_date, rec.frequency)
            if rec.end_date and rec.next_due_date > rec.end_date:
                rec.is_active = False
            count += 1

            await publish_notification(
                rec.user_id,
                {
                    "id": str(n.id),
                    "type": "recurring_created",
                    "title": n.title,
                    "message": n.message,
                },
            )
            await send_push_to_user(rec.user_id, n.title, n.message)
        await db.commit()
    return count
