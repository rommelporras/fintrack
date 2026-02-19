import pytest
import pytest_asyncio
from httpx import AsyncClient


@pytest_asyncio.fixture
async def auth_client(client: AsyncClient):
    await client.post("/auth/register", json={
        "email": "dashboard@test.com", "name": "Dashboard User", "password": "password123"
    })
    return client


async def test_net_worth_no_accounts(auth_client: AsyncClient):
    r = await auth_client.get("/dashboard/net-worth")
    assert r.status_code == 200
    data = r.json()
    assert data["total"] == "0.00"
    assert data["by_type"] == []


async def test_net_worth_excludes_inactive(auth_client: AsyncClient):
    await auth_client.post("/accounts", json={
        "name": "Inactive Bank", "type": "bank",
        "opening_balance": "50000.00", "currency": "PHP", "is_active": False,
    })
    r = await auth_client.get("/dashboard/net-worth")
    assert r.json()["total"] == "0.00"


async def test_net_worth_excludes_credit_card_type(auth_client: AsyncClient):
    await auth_client.post("/accounts", json={
        "name": "CC Account", "type": "credit_card",
        "opening_balance": "15000.00", "currency": "PHP",
    })
    r = await auth_client.get("/dashboard/net-worth")
    assert r.json()["total"] == "0.00"


async def test_net_worth_groups_by_type(auth_client: AsyncClient):
    await auth_client.post("/accounts", json={
        "name": "BDO", "type": "bank",
        "opening_balance": "100000.00", "currency": "PHP",
    })
    await auth_client.post("/accounts", json={
        "name": "GCash", "type": "digital_wallet",
        "opening_balance": "5000.00", "currency": "PHP",
    })
    await auth_client.post("/accounts", json={
        "name": "Cash", "type": "cash",
        "opening_balance": "2000.00", "currency": "PHP",
    })
    r = await auth_client.get("/dashboard/net-worth")
    data = r.json()
    assert data["total"] == "107000.00"
    types = {item["type"]: item["total"] for item in data["by_type"]}
    assert types["bank"] == "100000.00"
    assert types["digital_wallet"] == "5000.00"
    assert types["cash"] == "2000.00"
