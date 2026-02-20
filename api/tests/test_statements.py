import pytest
from httpx import AsyncClient


@pytest.fixture
async def credit_card_id(auth_client: AsyncClient) -> str:
    # Create account first
    acc = await auth_client.post("/accounts", json={
        "name": "BDO Checking", "type": "bank", "currency": "PHP"
    })
    account_id = acc.json()["id"]
    # Create credit card
    cc = await auth_client.post("/credit-cards", json={
        "account_id": account_id,
        "bank_name": "BDO",
        "last_four": "1234",
        "statement_day": 1,
        "due_day": 21,
    })
    assert cc.status_code == 201, cc.text
    return cc.json()["id"]


async def test_create_statement(auth_client: AsyncClient, credit_card_id: str):
    r = await auth_client.post("/statements", json={
        "credit_card_id": credit_card_id,
        "period_start": "2026-01-01",
        "period_end": "2026-01-31",
        "due_date": "2026-02-21",
        "total_amount": "5000.00",
        "minimum_due": "500.00",
    })
    assert r.status_code == 201
    data = r.json()
    assert data["credit_card_id"] == credit_card_id
    assert data["total_amount"] == "5000.00"
    assert data["is_paid"] is False
    assert data["paid_at"] is None


async def test_list_statements_empty(auth_client: AsyncClient):
    r = await auth_client.get("/statements")
    assert r.status_code == 200
    assert r.json() == []


async def test_list_statements_filter_by_credit_card(
    auth_client: AsyncClient, credit_card_id: str
):
    await auth_client.post("/statements", json={
        "credit_card_id": credit_card_id,
        "period_start": "2026-01-01",
        "period_end": "2026-01-31",
        "due_date": "2026-02-21",
    })
    r = await auth_client.get(f"/statements?credit_card_id={credit_card_id}")
    assert r.status_code == 200
    assert len(r.json()) == 1


async def test_list_statements_filter_by_paid(
    auth_client: AsyncClient, credit_card_id: str
):
    await auth_client.post("/statements", json={
        "credit_card_id": credit_card_id,
        "period_start": "2026-01-01",
        "period_end": "2026-01-31",
        "due_date": "2026-02-21",
    })
    r_unpaid = await auth_client.get("/statements?is_paid=false")
    assert len(r_unpaid.json()) == 1

    r_paid = await auth_client.get("/statements?is_paid=true")
    assert r_paid.json() == []


async def test_fetch_statement_by_id(
    auth_client: AsyncClient, credit_card_id: str
):
    created = await auth_client.post("/statements", json={
        "credit_card_id": credit_card_id,
        "period_start": "2026-01-01",
        "period_end": "2026-01-31",
        "due_date": "2026-02-21",
    })
    stmt_id = created.json()["id"]
    r = await auth_client.get(f"/statements/{stmt_id}")
    assert r.status_code == 200
    assert r.json()["id"] == stmt_id


async def test_fetch_statement_not_found(auth_client: AsyncClient):
    r = await auth_client.get("/statements/00000000-0000-0000-0000-000000000000")
    assert r.status_code == 404


async def test_patch_statement_mark_paid(
    auth_client: AsyncClient, credit_card_id: str
):
    created = await auth_client.post("/statements", json={
        "credit_card_id": credit_card_id,
        "period_start": "2026-01-01",
        "period_end": "2026-01-31",
        "due_date": "2026-02-21",
    })
    stmt_id = created.json()["id"]
    r = await auth_client.patch(f"/statements/{stmt_id}", json={"is_paid": True})
    assert r.status_code == 200
    assert r.json()["is_paid"] is True
    assert r.json()["paid_at"] is not None


async def test_patch_statement_update_amounts(
    auth_client: AsyncClient, credit_card_id: str
):
    created = await auth_client.post("/statements", json={
        "credit_card_id": credit_card_id,
        "period_start": "2026-01-01",
        "period_end": "2026-01-31",
        "due_date": "2026-02-21",
    })
    stmt_id = created.json()["id"]
    r = await auth_client.patch(f"/statements/{stmt_id}", json={
        "total_amount": "12345.67",
        "minimum_due": "1234.57",
    })
    assert r.status_code == 200
    assert r.json()["total_amount"] == "12345.67"


async def test_statement_requires_auth(client: AsyncClient):
    r = await client.get("/statements")
    assert r.status_code == 401


async def test_statement_not_visible_to_other_user(
    client: AsyncClient,
):
    # User A registers and creates statement
    await client.post("/auth/register", json={
        "email": "user_a_stmt@test.com", "name": "User A", "password": "password123"
    })
    acc = await client.post("/accounts", json={
        "name": "BDO Checking", "type": "bank", "currency": "PHP"
    })
    cc = await client.post("/credit-cards", json={
        "account_id": acc.json()["id"],
        "bank_name": "BDO",
        "last_four": "9999",
        "statement_day": 1,
        "due_day": 21,
    })
    stmt = await client.post("/statements", json={
        "credit_card_id": cc.json()["id"],
        "period_start": "2026-01-01",
        "period_end": "2026-01-31",
        "due_date": "2026-02-21",
    })
    stmt_id = stmt.json()["id"]

    # User B registers (replaces session cookie)
    await client.post("/auth/register", json={
        "email": "user_b_stmt@test.com", "name": "User B", "password": "password123"
    })
    r = await client.get(f"/statements/{stmt_id}")
    assert r.status_code == 404
