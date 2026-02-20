import asyncio

from app.tasks.celery import celery_app


@celery_app.task(name="app.tasks.recurring.generate_recurring_transactions_task")
def generate_recurring_transactions_task():
    from app.services.recurring import generate_recurring_transactions

    return asyncio.run(generate_recurring_transactions())
