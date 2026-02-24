import pytest_asyncio
from decimal import Decimal
from httpx import AsyncClient


@pytest_asyncio.fixture
async def cc_account_id(auth_client: AsyncClient) -> str:
    r = await auth_client.post("/accounts", json={
        "name": "BPI CC Account", "type": "credit_card"
    })
    assert r.status_code == 201
    return r.json()["id"]


@pytest_asyncio.fixture
async def credit_line_id(auth_client: AsyncClient) -> str:
    r = await auth_client.post("/credit-lines", json={
        "name": "BPI Credit Line",
        "total_limit": "50000.00",
    })
    assert r.status_code == 201
    return r.json()["id"]


async def test_list_credit_lines_empty(auth_client):
    r = await auth_client.get("/credit-lines")
    assert r.status_code == 200
    assert r.json() == []


async def test_create_credit_line(auth_client):
    r = await auth_client.post("/credit-lines", json={
        "name": "BPI Credit Line",
        "total_limit": "50000.00",
    })
    assert r.status_code == 201
    data = r.json()
    assert data["name"] == "BPI Credit Line"
    assert data["total_limit"] == "50000.00"
    assert data["available_credit"] == "50000.00"  # no cards yet
    assert data["cards"] == []


async def test_create_credit_line_no_limit(auth_client):
    r = await auth_client.post("/credit-lines", json={"name": "Unlimited Line"})
    assert r.status_code == 201
    data = r.json()
    assert data["total_limit"] is None
    assert data["available_credit"] is None


async def test_update_credit_line(auth_client, credit_line_id):
    r = await auth_client.patch(f"/credit-lines/{credit_line_id}", json={
        "name": "BPI Updated",
        "total_limit": "75000.00",
    })
    assert r.status_code == 200
    assert r.json()["name"] == "BPI Updated"
    assert r.json()["total_limit"] == "75000.00"


async def test_delete_credit_line_detaches_cards(auth_client, credit_line_id, cc_account_id):
    # Create a card in this line
    r = await auth_client.post("/credit-cards", json={
        "account_id": cc_account_id,
        "bank_name": "BPI",
        "last_four": "1234",
        "statement_day": 15,
        "due_day": 5,
        "credit_line_id": credit_line_id,
        "card_name": "Amore Cashback",
    })
    assert r.status_code == 201
    card_id = r.json()["id"]

    # Delete the line
    del_r = await auth_client.delete(f"/credit-lines/{credit_line_id}")
    assert del_r.status_code == 204

    # Card still exists, credit_line_id is now null
    card_r = await auth_client.get("/credit-cards")
    cards = card_r.json()
    card = next(c for c in cards if c["id"] == card_id)
    assert card["credit_line_id"] is None


async def test_delete_credit_line_not_found(auth_client):
    import uuid
    r = await auth_client.delete(f"/credit-lines/{uuid.uuid4()}")
    assert r.status_code == 404


async def test_available_credit_with_manual_override(auth_client):
    r = await auth_client.post("/credit-lines", json={
        "name": "Manual Line",
        "total_limit": "50000.00",
        "available_override": "12345.00",
    })
    assert r.status_code == 201
    assert r.json()["available_credit"] == "12345.00"


async def test_credit_card_with_credit_line(auth_client, credit_line_id, cc_account_id):
    r = await auth_client.post("/credit-cards", json={
        "account_id": cc_account_id,
        "bank_name": "BPI",
        "last_four": "5678",
        "statement_day": 15,
        "due_day": 5,
        "credit_line_id": credit_line_id,
        "card_name": "Rewards Blue",
    })
    assert r.status_code == 201
    data = r.json()
    assert data["credit_line_id"] == credit_line_id
    assert data["card_name"] == "Rewards Blue"
    # available_credit is None for line-backed cards (line owns it)
    assert data["available_credit"] is None


async def test_credit_lines_require_auth(client):
    r = await client.get("/credit-lines")
    assert r.status_code == 401


async def test_credit_line_available_credit_decreases_with_spending(
    auth_client, credit_line_id, cc_account_id
):
    # Attach card to the line
    await auth_client.post("/credit-cards", json={
        "account_id": cc_account_id,
        "bank_name": "BPI",
        "last_four": "9999",
        "statement_day": 15,
        "due_day": 5,
        "credit_line_id": credit_line_id,
    })

    # Create a category to use for the transaction
    cat_r = await auth_client.post("/categories", json={
        "name": "Shopping", "type": "expense", "icon": "🛍️", "color": "#f97316",
    })
    assert cat_r.status_code == 201
    category_id = cat_r.json()["id"]

    await auth_client.post("/transactions", json={
        "account_id": cc_account_id,
        "type": "expense",
        "amount": "5000.00",
        "date": "2026-02-24",
        "category_id": category_id,
        "description": "Test purchase",
    })

    # Available credit should now be 50000 - 5000 = 45000
    line_r = await auth_client.get("/credit-lines")
    line = next(l for l in line_r.json() if l["id"] == credit_line_id)
    assert Decimal(line["available_credit"]) == Decimal("45000.00")
