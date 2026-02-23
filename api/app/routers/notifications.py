import asyncio
import json
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func
from app.core.database import get_db, AsyncSessionLocal
from app.dependencies import get_current_user
from app.models.notification import Notification
from app.models.push_subscription import PushSubscription
from app.models.user import User
from app.schemas.notification import NotificationResponse, NotificationListResponse
from app.schemas.push_subscription import PushSubscriptionCreate, PushSubscriptionDelete
from app.services.pubsub import get_redis, _channel

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=NotificationListResponse)
async def list_notifications(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    base = select(Notification).where(Notification.user_id == current_user.id)
    count_result = await db.execute(select(func.count()).select_from(base.subquery()))
    total = count_result.scalar_one()
    result = await db.execute(
        base.order_by(Notification.is_read.asc(), Notification.created_at.desc())
        .limit(limit).offset(offset)
    )
    return {"items": result.scalars().all(), "total": total}


@router.patch("/read-all")
async def mark_all_read(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from datetime import datetime, timezone
    await db.execute(
        update(Notification)
        .where(Notification.user_id == current_user.id, Notification.is_read == False)  # noqa: E712
        .values(is_read=True, read_at=datetime.now(timezone.utc))
    )
    await db.commit()
    return {"ok": True}


@router.get("/stream")
async def notification_stream(
    current_user: User = Depends(get_current_user),
):
    """SSE stream: sends initial unreads then yields from Redis pub/sub."""
    async def generator():
        # Send initial unread notifications
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(Notification)
                .where(
                    Notification.user_id == current_user.id,
                    Notification.is_read == False,  # noqa: E712
                )
                .order_by(Notification.created_at.desc())
                .limit(20)
            )
            for n in result.scalars().all():
                payload = {
                    "id": str(n.id),
                    "type": n.type,
                    "title": n.title,
                    "message": n.message,
                }
                yield f"data: {json.dumps(payload)}\n\n"

        # Keep connection open, yield from Redis pub/sub with 30s keepalive
        r = None
        pubsub = None
        channel = _channel(current_user.id)
        try:
            r = await get_redis()
            pubsub = r.pubsub()
            await pubsub.subscribe(channel)
            while True:
                try:
                    message = await asyncio.wait_for(
                        pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0),
                        timeout=30.0,
                    )
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
                    continue
                if message and message["type"] == "message":
                    # decode_responses=True guarantees str, not bytes
                    yield f"data: {message['data']}\n\n"
        except Exception:
            # Redis unavailable or client disconnected — end stream gracefully
            return
        finally:
            if pubsub is not None:
                try:
                    await pubsub.unsubscribe(channel)
                    await pubsub.aclose()
                except Exception:
                    pass
            if r is not None:
                try:
                    await r.aclose()
                except Exception:
                    pass

    return StreamingResponse(
        generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/push-subscribe", status_code=status.HTTP_201_CREATED)
async def push_subscribe(
    data: PushSubscriptionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(
        select(PushSubscription).where(PushSubscription.endpoint == data.endpoint)
    )
    sub = existing.scalar_one_or_none()
    if sub:
        sub.p256dh = data.keys.p256dh
        sub.auth = data.keys.auth
        sub.user_id = current_user.id
    else:
        sub = PushSubscription(
            user_id=current_user.id,
            endpoint=data.endpoint,
            p256dh=data.keys.p256dh,
            auth=data.keys.auth,
        )
        db.add(sub)
    await db.commit()
    return {"ok": True}


@router.delete("/push-unsubscribe", status_code=status.HTTP_204_NO_CONTENT)
async def push_unsubscribe(
    data: PushSubscriptionDelete,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PushSubscription).where(
            PushSubscription.endpoint == data.endpoint,
            PushSubscription.user_id == current_user.id,
        )
    )
    sub = result.scalar_one_or_none()
    if sub:
        await db.delete(sub)
        await db.commit()


@router.patch("/{notification_id}/read", response_model=NotificationResponse)
async def mark_single_read(
    notification_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == current_user.id,
        )
    )
    n = result.scalar_one_or_none()
    if not n:
        raise HTTPException(status_code=404, detail="Notification not found")
    from datetime import datetime, timezone
    n.is_read = True
    n.read_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(n)
    return n
