from httpx import AsyncClient


async def test_net_worth_no_accounts(auth_client: AsyncClient):
    r = await auth_client.get("/dashboard/net-worth")
    assert r.status_code == 200
    data = r.json()
    assert data["total"] == "0.00"
    assert data["by_type"] == []


async def test_net_worth_excludes_inactive(auth_client: AsyncClient):
    await auth_client.post("/accounts", json={
        "name": "Inactive Bank", "type": "savings",
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
        "name": "BDO", "type": "savings",
        "opening_balance": "100000.00", "currency": "PHP",
    })
    await auth_client.post("/accounts", json={
        "name": "GCash", "type": "wallet",
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
    assert types["savings"] == "100000.00"
    assert types["wallet"] == "5000.00"
    assert types["cash"] == "2000.00"
