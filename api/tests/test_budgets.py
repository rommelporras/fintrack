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
