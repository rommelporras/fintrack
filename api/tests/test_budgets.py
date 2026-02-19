from datetime import date, timedelta
import uuid
import pytest
from httpx import AsyncClient


@pytest.fixture
async def auth_client(client: AsyncClient):
    await client.post("/auth/register", json={
        "email": "budget@test.com", "name": "Budget User", "password": "password123"
    })
    return client


@pytest.fixture
async def account_id(auth_client: AsyncClient) -> str:
    r = await auth_client.post("/accounts", json={
        "name": "BDO Checking", "type": "bank", "currency": "PHP"
    })
    assert r.status_code == 201
    return r.json()["id"]


@pytest.fixture
async def category_id(auth_client: AsyncClient) -> str:
    r = await auth_client.post("/categories", json={
        "name": "Groceries", "type": "expense", "icon": "🛒", "color": "#f97316"
    })
    assert r.status_code == 201
    return r.json()["id"]


async def test_create_category_budget(auth_client: AsyncClient, category_id: str):
    r = await auth_client.post("/budgets", json={
        "type": "category",
        "category_id": category_id,
        "amount": "10000.00",
    })
    assert r.status_code == 201
    data = r.json()
    assert data["type"] == "category"
    assert data["category_id"] == category_id
    assert data["amount"] == "10000.00"


async def test_create_account_budget(auth_client: AsyncClient, account_id: str):
    r = await auth_client.post("/budgets", json={
        "type": "account",
        "account_id": account_id,
        "amount": "5000.00",
    })
    assert r.status_code == 201
    data = r.json()
    assert data["type"] == "account"
    assert data["account_id"] == account_id


async def test_create_budget_invalid_type(auth_client: AsyncClient, category_id: str):
    r = await auth_client.post("/budgets", json={
        "type": "invalid",
        "category_id": category_id,
        "amount": "1000",
    })
    assert r.status_code == 422


async def test_list_budgets(auth_client: AsyncClient, category_id: str):
    await auth_client.post("/budgets", json={
        "type": "category", "category_id": category_id, "amount": "10000"
    })
    r = await auth_client.get("/budgets")
    assert r.status_code == 200
    assert len(r.json()) == 1


async def test_list_budgets_empty(auth_client: AsyncClient):
    r = await auth_client.get("/budgets")
    assert r.status_code == 200
    assert r.json() == []


async def test_update_budget_amount(auth_client: AsyncClient, category_id: str):
    created = await auth_client.post("/budgets", json={
        "type": "category", "category_id": category_id, "amount": "10000"
    })
    budget_id = created.json()["id"]
    r = await auth_client.patch(f"/budgets/{budget_id}", json={"amount": "15000.00"})
    assert r.status_code == 200
    assert r.json()["amount"] == "15000.00"


async def test_delete_budget(auth_client: AsyncClient, category_id: str):
    created = await auth_client.post("/budgets", json={
        "type": "category", "category_id": category_id, "amount": "10000"
    })
    budget_id = created.json()["id"]
    r = await auth_client.delete(f"/budgets/{budget_id}")
    assert r.status_code == 204

    r2 = await auth_client.get("/budgets")
    assert r2.json() == []


async def test_delete_budget_not_found(auth_client: AsyncClient):
    r = await auth_client.delete("/budgets/00000000-0000-0000-0000-000000000000")
    assert r.status_code == 404


async def test_budget_requires_auth(client: AsyncClient):
    r = await client.get("/budgets")
    assert r.status_code == 401


async def _create_expense(db, user_id: str, account_id: str, category_id: str,
                           amount: str, txn_date: date | None = None) -> None:
    """Insert an expense transaction directly into DB (bypasses budget check)."""
    import uuid
    from app.models.transaction import Transaction, TransactionType, TransactionSource
    txn = Transaction(
        user_id=uuid.UUID(user_id),
        account_id=uuid.UUID(account_id),
        category_id=uuid.UUID(category_id),
        amount=amount,
        description="test expense",
        type=TransactionType.expense,
        source=TransactionSource.manual,
        date=txn_date or date.today(),
        created_by=uuid.UUID(user_id),
    )
    db.add(txn)
    await db.commit()


async def test_budget_status_ok(auth_client: AsyncClient, db, account_id: str, category_id: str):
    await auth_client.post("/budgets", json={
        "type": "category", "category_id": category_id, "amount": "10000.00"
    })
    me = await auth_client.get("/auth/me")
    user_id = me.json()["id"]

    # Insert 7900 (79% of 10000 — should be ok)
    await _create_expense(db, user_id, account_id, category_id, "7900.00")

    r = await auth_client.get("/budgets/status")
    assert r.status_code == 200
    items = r.json()
    assert len(items) == 1
    assert items[0]["status"] == "ok"
    assert float(items[0]["percent"]) == pytest.approx(79.0, abs=0.01)


async def test_budget_status_warning(auth_client: AsyncClient, db, account_id: str, category_id: str):
    await auth_client.post("/budgets", json={
        "type": "category", "category_id": category_id, "amount": "10000.00"
    })
    me = await auth_client.get("/auth/me")
    user_id = me.json()["id"]

    # Insert 8000 (80% — should be warning)
    await _create_expense(db, user_id, account_id, category_id, "8000.00")

    r = await auth_client.get("/budgets/status")
    items = r.json()
    assert items[0]["status"] == "warning"
    assert float(items[0]["percent"]) == pytest.approx(80.0, abs=0.01)


async def test_budget_status_exceeded(auth_client: AsyncClient, db, account_id: str, category_id: str):
    await auth_client.post("/budgets", json={
        "type": "category", "category_id": category_id, "amount": "10000.00"
    })
    me = await auth_client.get("/auth/me")
    user_id = me.json()["id"]

    # Insert 10001 (100.01% — should be exceeded)
    await _create_expense(db, user_id, account_id, category_id, "10001.00")

    r = await auth_client.get("/budgets/status")
    items = r.json()
    assert items[0]["status"] == "exceeded"
    assert float(items[0]["percent"]) > 100.0


async def test_budget_status_zero_spent(auth_client: AsyncClient, category_id: str):
    await auth_client.post("/budgets", json={
        "type": "category", "category_id": category_id, "amount": "10000.00"
    })
    r = await auth_client.get("/budgets/status")
    items = r.json()
    assert items[0]["status"] == "ok"
    assert float(items[0]["percent"]) == 0.0
    assert items[0]["spent"] == "0.00"


async def test_budget_status_only_counts_current_month(
    auth_client: AsyncClient, db, account_id: str, category_id: str
):
    await auth_client.post("/budgets", json={
        "type": "category", "category_id": category_id, "amount": "10000.00"
    })
    me = await auth_client.get("/auth/me")
    user_id = me.json()["id"]

    # Transaction last month should NOT count
    last_month = date.today().replace(day=1) - timedelta(days=1)
    await _create_expense(db, user_id, account_id, category_id, "9999.00", txn_date=last_month)

    r = await auth_client.get("/budgets/status")
    items = r.json()
    assert items[0]["status"] == "ok"
    assert items[0]["spent"] == "0.00"


async def test_budget_status_wrong_category_not_counted(
    auth_client: AsyncClient, db, account_id: str
):
    """Transaction in category B should not affect budget for category A."""
    # Create two expense categories
    cat_a_r = await auth_client.post("/categories", json={"name": "Category A", "type": "expense"})
    assert cat_a_r.status_code == 201
    cat_a_id = cat_a_r.json()["id"]

    cat_b_r = await auth_client.post("/categories", json={"name": "Category B", "type": "expense"})
    assert cat_b_r.status_code == 201
    cat_b_id = cat_b_r.json()["id"]

    # Budget on cat_a
    await auth_client.post("/budgets", json={
        "type": "category", "category_id": cat_a_id, "amount": "10000.00"
    })
    me = await auth_client.get("/auth/me")
    user_id = me.json()["id"]

    # Transaction in cat_b should not count toward cat_a budget
    await _create_expense(db, user_id, account_id, cat_b_id, "9999.00")

    r = await auth_client.get("/budgets/status")
    items = r.json()
    assert items[0]["status"] == "ok"
    assert items[0]["spent"] == "0.00"


from unittest.mock import AsyncMock, patch
from sqlalchemy import select
import app.core.config as cfg
from app.models.notification import Notification, NotificationType


async def test_budget_alert_fires_at_80_percent(
    auth_client: AsyncClient, db, account_id: str, category_id: str, monkeypatch
):
    monkeypatch.setattr(cfg.settings, "discord_webhook_url", "")

    # Create budget ₱10,000
    await auth_client.post("/budgets", json={
        "type": "category", "category_id": category_id, "amount": "10000.00"
    })
    me = await auth_client.get("/auth/me")
    user_id = me.json()["id"]

    # Insert ₱7,900 directly (79%)
    await _create_expense(db, user_id, account_id, category_id, "7900.00")

    # POST ₱100 via API — total ₱8,000 (80%) → triggers warning
    r = await auth_client.post("/transactions", json={
        "account_id": account_id,
        "category_id": category_id,
        "amount": "100.00",
        "type": "expense",
        "date": str(date.today()),
        "description": "coffee",
    })
    assert r.status_code == 201

    notifs_result = await db.execute(
        select(Notification).where(Notification.user_id == uuid.UUID(user_id))
    )
    notifs = notifs_result.scalars().all()
    assert len(notifs) == 1
    assert notifs[0].type == NotificationType.budget_warning


async def test_budget_alert_not_duplicated(
    auth_client: AsyncClient, db, account_id: str, category_id: str, monkeypatch
):
    monkeypatch.setattr(cfg.settings, "discord_webhook_url", "")

    await auth_client.post("/budgets", json={
        "type": "category", "category_id": category_id, "amount": "10000.00"
    })
    me = await auth_client.get("/auth/me")
    user_id = me.json()["id"]

    # Direct insert to get to 79%
    await _create_expense(db, user_id, account_id, category_id, "7900.00")

    # First API transaction: total = 8000 (80%) → fires warning
    await auth_client.post("/transactions", json={
        "account_id": account_id,
        "category_id": category_id,
        "amount": "100.00",
        "type": "expense",
        "date": str(date.today()),
        "description": "first",
    })

    # Second API transaction: total = 8100 (81%) → should NOT create another warning
    await auth_client.post("/transactions", json={
        "account_id": account_id,
        "category_id": category_id,
        "amount": "100.00",
        "type": "expense",
        "date": str(date.today()),
        "description": "second",
    })

    notifs_result = await db.execute(
        select(Notification).where(Notification.user_id == uuid.UUID(user_id))
    )
    notifs = notifs_result.scalars().all()
    warning_notifs = [n for n in notifs if n.type == NotificationType.budget_warning]
    assert len(warning_notifs) == 1  # Only one warning, not two


async def test_budget_exceeded_alert(
    auth_client: AsyncClient, db, account_id: str, category_id: str, monkeypatch
):
    monkeypatch.setattr(cfg.settings, "discord_webhook_url", "")

    await auth_client.post("/budgets", json={
        "type": "category", "category_id": category_id, "amount": "10000.00"
    })
    me = await auth_client.get("/auth/me")
    user_id = me.json()["id"]

    # Get to 99.9%
    await _create_expense(db, user_id, account_id, category_id, "9990.00")

    # Push over 100% via API
    await auth_client.post("/transactions", json={
        "account_id": account_id,
        "category_id": category_id,
        "amount": "20.00",
        "type": "expense",
        "date": str(date.today()),
        "description": "over budget",
    })

    notifs_result = await db.execute(
        select(Notification).where(Notification.user_id == uuid.UUID(user_id))
    )
    notifs = notifs_result.scalars().all()
    types = {n.type for n in notifs}
    assert NotificationType.budget_exceeded in types


async def test_budget_alert_discord_called(
    auth_client: AsyncClient, db, account_id: str, category_id: str, monkeypatch
):
    monkeypatch.setattr(cfg.settings, "discord_webhook_url", "https://discord.com/api/webhooks/test")

    await auth_client.post("/budgets", json={
        "type": "category", "category_id": category_id, "amount": "10000.00"
    })
    me = await auth_client.get("/auth/me")
    user_id = me.json()["id"]

    await _create_expense(db, user_id, account_id, category_id, "7900.00")

    with patch("app.services.discord.httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        await auth_client.post("/transactions", json={
            "account_id": account_id,
            "category_id": category_id,
            "amount": "100.00",
            "type": "expense",
            "date": str(date.today()),
            "description": "webhook test",
        })
        mock_post.assert_called_once()
