import uuid
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.notification import Notification, NotificationType


async def _get_user_id(auth_client: AsyncClient) -> str:
    r = await auth_client.get("/auth/me")
    return r.json()["id"]


async def _create_notification(
    db: AsyncSession,
    user_id: str,
    type: NotificationType = NotificationType.budget_warning,
    is_read: bool = False,
    title: str = "Test Notification",
    message: str = "Test message",
) -> Notification:
    n = Notification(
        user_id=uuid.UUID(user_id),
        type=type,
        title=title,
        message=message,
        is_read=is_read,
    )
    db.add(n)
    await db.commit()
    await db.refresh(n)
    return n


async def test_list_notifications_empty(auth_client: AsyncClient):
    r = await auth_client.get("/notifications")
    assert r.status_code == 200
    data = r.json()
    assert data["items"] == []
    assert data["total"] == 0


async def test_list_notifications_unread_first(auth_client: AsyncClient, db: AsyncSession):
    user_id = await _get_user_id(auth_client)

    read_notif = await _create_notification(db, user_id, is_read=True, title="Read one")
    unread_notif = await _create_notification(db, user_id, is_read=False, title="Unread one")

    r = await auth_client.get("/notifications")
    assert r.status_code == 200
    data = r.json()
    items = data["items"]
    assert len(items) == 2
    assert data["total"] == 2
    # Unread comes first
    assert items[0]["title"] == "Unread one"
    assert items[1]["title"] == "Read one"


async def test_mark_single_read(auth_client: AsyncClient, db: AsyncSession):
    user_id = await _get_user_id(auth_client)
    n = await _create_notification(db, user_id, is_read=False)

    r = await auth_client.patch(f"/notifications/{n.id}/read")
    assert r.status_code == 200
    assert r.json()["is_read"] is True


async def test_mark_single_read_not_found(auth_client: AsyncClient):
    r = await auth_client.patch("/notifications/00000000-0000-0000-0000-000000000000/read")
    assert r.status_code == 404


async def test_mark_all_read(auth_client: AsyncClient, db: AsyncSession):
    user_id = await _get_user_id(auth_client)
    for i in range(3):
        await _create_notification(db, user_id, is_read=False, title=f"Notif {i}")

    r = await auth_client.patch("/notifications/read-all")
    assert r.status_code == 200

    r2 = await auth_client.get("/notifications")
    assert all(n["is_read"] for n in r2.json()["items"])


async def test_list_notifications_limit(auth_client: AsyncClient, db: AsyncSession):
    user_id = await _get_user_id(auth_client)
    for i in range(55):
        await _create_notification(db, user_id, title=f"Notif {i}")

    r = await auth_client.get("/notifications")
    assert r.status_code == 200
    data = r.json()
    assert len(data["items"]) == 50  # default limit
    assert data["total"] == 55  # but total reflects all


async def test_notifications_require_auth(client: AsyncClient):
    r = await client.get("/notifications")
    assert r.status_code == 401


async def test_stream_returns_event_stream(auth_client: AsyncClient):
    """Verify the SSE endpoint returns correct content-type and 200."""
    async with auth_client.stream("GET", "/notifications/stream") as r:
        assert r.status_code == 200
        assert "text/event-stream" in r.headers["content-type"]
