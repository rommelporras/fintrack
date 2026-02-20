import pytest_asyncio
from httpx import AsyncClient


@pytest_asyncio.fixture
async def account_id(auth_client: AsyncClient) -> str:
    r = await auth_client.post("/accounts", json={
        "name": "BDO Checking", "type": "bank", "currency": "PHP"
    })
    assert r.status_code == 201
    return r.json()["id"]


async def test_spending_by_category_empty(auth_client: AsyncClient):
    r = await auth_client.get("/analytics/spending-by-category?year=2020&month=1")
    assert r.status_code == 200
    assert r.json() == []


async def test_spending_by_category_excludes_income_and_transfers(
    auth_client: AsyncClient, account_id: str
):
    cat = (await auth_client.post("/categories", json={
        "name": "TestCat", "type": "income", "icon": "tag", "color": "#FF0000",
    })).json()

    # Income — excluded
    await auth_client.post("/transactions", json={
        "account_id": account_id, "category_id": cat["id"],
        "amount": "5000.00", "type": "income", "date": "2026-02-01",
        "description": "Salary",
    })
    # Transfer — excluded (no category needed)
    await auth_client.post("/transactions", json={
        "account_id": account_id,
        "amount": "1000.00", "type": "transfer", "date": "2026-02-01",
        "description": "GCash top up",
    })

    r = await auth_client.get("/analytics/spending-by-category?year=2026&month=2")
    assert r.json() == []


async def test_spending_by_category_sums_correctly(
    auth_client: AsyncClient, account_id: str
):
    cat_a = (await auth_client.post("/categories", json={
        "name": "Groceries", "type": "expense", "icon": "🛒", "color": "#00FF00",
    })).json()
    cat_b = (await auth_client.post("/categories", json={
        "name": "Dining", "type": "expense", "icon": "🍜", "color": "#0000FF",
    })).json()

    for amount in ["3000.00", "1500.00"]:
        await auth_client.post("/transactions", json={
            "account_id": account_id, "category_id": cat_a["id"],
            "amount": amount, "type": "expense", "date": "2026-02-05",
            "description": "grocery run",
        })
    await auth_client.post("/transactions", json={
        "account_id": account_id, "category_id": cat_b["id"],
        "amount": "800.00", "type": "expense", "date": "2026-02-12",
        "description": "jollibee",
    })

    r = await auth_client.get("/analytics/spending-by-category?year=2026&month=2")
    data = r.json()
    totals = {item["category_name"]: item["total"] for item in data}
    assert totals["Groceries"] == "4500.00"
    assert totals["Dining"] == "800.00"
    assert len(data) == 2


async def test_spending_by_category_cross_user_isolation(
    auth_client: AsyncClient, account_id: str
):
    from httpx import AsyncClient as HttpxClient, ASGITransport
    from app.main import app as fastapi_app

    # Primary user creates a real expense
    primary_cat = (await auth_client.post("/categories", json={
        "name": "PrimaryCat", "type": "expense", "icon": "tag", "color": "#FFFFFF",
    })).json()
    await auth_client.post("/transactions", json={
        "account_id": account_id, "category_id": primary_cat["id"],
        "amount": "100.00", "type": "expense", "date": "2026-02-01",
        "description": "primary spend",
    })

    # Second user on a separate client with its own cookie jar.
    # ASGITransport(app=fastapi_app) shares the same app.dependency_overrides
    # (set by the client fixture), so the second client hits the same test DB.
    async with HttpxClient(
        transport=ASGITransport(app=fastapi_app), base_url="http://localhost"
    ) as other_client:
        await other_client.post("/auth/register", json={
            "email": "other_analytics@test.com", "name": "Other", "password": "password123"
        })
        await other_client.post("/auth/login", json={
            "email": "other_analytics@test.com", "password": "password123"
        })
        other_acc = (await other_client.post("/accounts", json={
            "name": "Other Bank", "type": "bank", "currency": "PHP"
        })).json()
        other_cat = (await other_client.post("/categories", json={
            "name": "OtherCat", "type": "expense", "icon": "x", "color": "#123456",
        })).json()
        await other_client.post("/transactions", json={
            "account_id": other_acc["id"], "category_id": other_cat["id"],
            "amount": "9999.00", "type": "expense", "date": "2026-02-01",
            "description": "other user spend",
        })

    # Primary user must see their own data but NOT the other user's
    r = await auth_client.get("/analytics/spending-by-category?year=2026&month=2")
    names = {item["category_name"] for item in r.json()}
    assert "OtherCat" not in names
    assert "PrimaryCat" in names


async def test_statement_history_no_cards(auth_client: AsyncClient):
    r = await auth_client.get("/analytics/statement-history")
    assert r.status_code == 200
    assert r.json() == []


async def test_statement_history_single_card(auth_client: AsyncClient):
    acc = (await auth_client.post("/accounts", json={
        "name": "BDO CC", "type": "bank", "currency": "PHP"
    })).json()
    card = (await auth_client.post("/credit-cards", json={
        "account_id": acc["id"], "bank_name": "BDO",
        "last_four": "1234", "statement_day": 1, "due_day": 25,
    })).json()

    await auth_client.post("/statements", json={
        "credit_card_id": card["id"],
        "period_start": "2026-01-01", "period_end": "2026-01-31",
        "due_date": "2026-02-25", "total_amount": "15000.00", "minimum_due": "500.00",
    })
    await auth_client.post("/statements", json={
        "credit_card_id": card["id"],
        "period_start": "2026-02-01", "period_end": "2026-02-28",
        "due_date": "2026-03-25", "total_amount": "22000.00", "minimum_due": "500.00",
    })

    r = await auth_client.get("/analytics/statement-history")
    data = r.json()
    assert len(data) == 1
    assert data[0]["card_label"] == "BDO •••• 1234"
    stmts = data[0]["statements"]
    assert len(stmts) == 2
    # Chronological order (oldest first)
    assert stmts[0]["period"] == "Jan 2026"
    assert stmts[0]["total"] == "15000.00"
    assert stmts[1]["period"] == "Feb 2026"
    assert stmts[1]["total"] == "22000.00"


async def test_statement_history_limits_to_6(auth_client: AsyncClient):
    acc = (await auth_client.post("/accounts", json={
        "name": "BPI CC", "type": "bank", "currency": "PHP"
    })).json()
    card = (await auth_client.post("/credit-cards", json={
        "account_id": acc["id"], "bank_name": "BPI",
        "last_four": "5678", "statement_day": 5, "due_day": 28,
    })).json()

    for i in range(8):
        month = i + 1
        await auth_client.post("/statements", json={
            "credit_card_id": card["id"],
            "period_start": f"2025-{month:02d}-01",
            "period_end": f"2025-{month:02d}-28",
            "due_date": f"2025-{month:02d}-28",
            "total_amount": str(1000 * (i + 1)),
            "minimum_due": "300.00",
        })

    r = await auth_client.get("/analytics/statement-history")
    card_data = next(d for d in r.json() if "5678" in d["card_label"])
    # Only the 6 most recent statements returned
    assert len(card_data["statements"]) == 6
    # Chronological — first is month 3 (total 3000), last is month 8 (total 8000)
    assert card_data["statements"][0]["total"] == "3000.00"
    assert card_data["statements"][-1]["total"] == "8000.00"
