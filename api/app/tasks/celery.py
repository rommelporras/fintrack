from celery import Celery
from celery.schedules import crontab
from app.core.config import settings

celery_app = Celery(
    "finance",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["app.tasks.documents", "app.tasks.notifications"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="Asia/Manila",
    enable_utc=True,
)

celery_app.conf.beat_schedule = {
    "check-statement-due-dates": {
        "task": "app.tasks.notifications.check_statement_due_dates",
        "schedule": crontab(hour=9, minute=0),  # 9am Asia/Manila daily
    }
}
