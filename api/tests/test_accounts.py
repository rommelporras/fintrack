import pytest


@pytest.mark.asyncio
async def test_create_and_list_account(client):
    await client.post("/auth/register", json={"email": "a@test.com", "name": "A", "password": "changeme123"})
    r = await client.post("/accounts", json={"name": "BPI Savings", "type": "savings", "opening_balance": "5000.00"})
    assert r.status_code == 201
    data = r.json()
    assert data["name"] == "BPI Savings"
    assert data["opening_balance"] == "5000.00"
    assert data["current_balance"] == "5000.00"  # no transactions yet

    r = await client.get("/accounts")
    assert r.status_code == 200
    assert len(r.json()) == 1


@pytest.mark.asyncio
async def test_update_account(client):
    await client.post("/auth/register", json={"email": "b@test.com", "name": "B", "password": "changeme123"})
    r = await client.post("/accounts", json={"name": "Cash", "type": "cash"})
    account_id = r.json()["id"]

    r = await client.patch(f"/accounts/{account_id}", json={"name": "Petty Cash"})
    assert r.status_code == 200
    assert r.json()["name"] == "Petty Cash"


@pytest.mark.asyncio
async def test_delete_account(client):
    await client.post("/auth/register", json={"email": "c@test.com", "name": "C", "password": "changeme123"})
    r = await client.post("/accounts", json={"name": "Temp", "type": "cash"})
    account_id = r.json()["id"]

    r = await client.delete(f"/accounts/{account_id}")
    assert r.status_code == 204

    r = await client.get("/accounts")
    assert r.json() == []


@pytest.mark.asyncio
async def test_accounts_require_auth(client):
    r = await client.get("/accounts")
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_get_account_by_id(client):
    await client.post("/auth/register", json={"email": "getid@test.com", "name": "G", "password": "changeme123"})
    r = await client.post("/accounts", json={"name": "Savings", "type": "savings", "opening_balance": "1000.00"})
    account_id = r.json()["id"]
    r2 = await client.get(f"/accounts/{account_id}")
    assert r2.status_code == 200
    assert r2.json()["name"] == "Savings"
    assert r2.json()["id"] == account_id


@pytest.mark.asyncio
async def test_get_account_not_found(client):
    await client.post("/auth/register", json={"email": "notfound@test.com", "name": "NF", "password": "changeme123"})
    import uuid
    fake_id = str(uuid.uuid4())
    r = await client.get(f"/accounts/{fake_id}")
    assert r.status_code == 404


async def test_create_account_with_institution(auth_client):
    # Create institution first
    r = await auth_client.post("/institutions", json={"name": "BPI", "type": "traditional"})
    inst_id = r.json()["id"]

    r = await auth_client.post("/accounts", json={
        "name": "BPI Savings",
        "type": "savings",
        "institution_id": inst_id,
        "opening_balance": "50000.00",
    })
    assert r.status_code == 201
    data = r.json()
    assert data["institution_id"] == inst_id
    assert data["institution"]["name"] == "BPI"
    assert data["institution"]["type"] == "traditional"


async def test_account_institution_is_null_for_cash(auth_client):
    r = await auth_client.post("/accounts", json={
        "name": "Cash Wallet",
        "type": "cash",
    })
    assert r.status_code == 201
    assert r.json()["institution_id"] is None
    assert r.json()["institution"] is None
