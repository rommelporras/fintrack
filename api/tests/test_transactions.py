import pytest


@pytest.fixture
async def user_and_accounts(client):
    """Register a user and create two accounts, return their IDs."""
    await client.post("/auth/register", json={
        "email": "txn@test.com", "name": "TXN User", "password": "password123"
    })
    bank = await client.post("/accounts", json={
        "name": "BDO Savings", "type": "bank", "opening_balance": "10000.00"
    })
    wallet = await client.post("/accounts", json={
        "name": "GCash", "type": "digital_wallet", "opening_balance": "5000.00"
    })
    return {
        "bank_id": bank.json()["id"],
        "wallet_id": wallet.json()["id"],
    }


async def test_create_income_transaction(client, user_and_accounts):
    ids = user_and_accounts
    r = await client.post("/transactions", json={
        "account_id": ids["bank_id"],
        "amount": "25000.00",
        "type": "income",
        "sub_type": "salary",
        "date": "2026-02-15",
        "description": "February salary",
    })
    assert r.status_code == 201
    data = r.json()
    assert data["amount"] == "25000.00"
    assert data["type"] == "income"
    assert data["sub_type"] == "salary"


async def test_create_expense_transaction(client, user_and_accounts):
    ids = user_and_accounts
    r = await client.post("/transactions", json={
        "account_id": ids["bank_id"],
        "amount": "350.00",
        "type": "expense",
        "sub_type": "regular",
        "date": "2026-02-19",
        "description": "Lunch",
    })
    assert r.status_code == 201
    assert r.json()["type"] == "expense"


async def test_list_transactions(client, user_and_accounts):
    ids = user_and_accounts
    await client.post("/transactions", json={
        "account_id": ids["bank_id"], "amount": "1000.00",
        "type": "income", "date": "2026-02-01",
    })
    await client.post("/transactions", json={
        "account_id": ids["bank_id"], "amount": "200.00",
        "type": "expense", "date": "2026-02-05",
    })
    r = await client.get("/transactions")
    assert r.status_code == 200
    assert len(r.json()["items"]) >= 2


async def test_filter_by_type(client, user_and_accounts):
    ids = user_and_accounts
    await client.post("/transactions", json={
        "account_id": ids["bank_id"], "amount": "5000.00",
        "type": "income", "date": "2026-02-10",
    })
    await client.post("/transactions", json={
        "account_id": ids["bank_id"], "amount": "100.00",
        "type": "expense", "date": "2026-02-10",
    })
    r = await client.get("/transactions?type=income")
    assert r.status_code == 200
    assert all(t["type"] == "income" for t in r.json()["items"])


async def test_delete_transaction(client, user_and_accounts):
    ids = user_and_accounts
    r = await client.post("/transactions", json={
        "account_id": ids["bank_id"], "amount": "500.00",
        "type": "expense", "date": "2026-02-19",
    })
    txn_id = r.json()["id"]
    del_r = await client.delete(f"/transactions/{txn_id}")
    assert del_r.status_code == 204
    r2 = await client.get("/transactions")
    assert all(t["id"] != txn_id for t in r2.json()["items"])


async def test_atm_withdrawal_with_fee(client):
    """₱5,000 ATM withdrawal with ₱18 fee — total deducted ₱5,018."""
    await client.post("/auth/register", json={
        "email": "atm@test.com", "name": "ATM User", "password": "pw123456"
    })
    gcash = await client.post("/accounts", json={
        "name": "GCash", "type": "digital_wallet", "opening_balance": "10000.00"
    })
    cash = await client.post("/accounts", json={
        "name": "Cash Wallet", "type": "cash"
    })
    gcash_id = gcash.json()["id"]
    cash_id = cash.json()["id"]

    r = await client.post("/transactions", json={
        "account_id": gcash_id,
        "to_account_id": cash_id,
        "amount": "5000.00",
        "fee_amount": "18.00",
        "type": "transfer",
        "sub_type": "atm_withdrawal",
        "date": "2026-02-19",
        "description": "ATM withdrawal BDO",
    })
    assert r.status_code == 201
    data = r.json()
    assert data["amount"] == "5000.00"
    assert data["fee_amount"] == "18.00"

    # GCash balance: 10000 - 5000 (transfer out) - 18 (fee) = 4982
    r2 = await client.get(f"/accounts/{gcash_id}")
    assert r2.json()["current_balance"] == "4982.00"


async def test_transactions_require_auth(client):
    r = await client.get("/transactions")
    assert r.status_code == 401


async def test_invalid_amount_rejected(client, user_and_accounts):
    ids = user_and_accounts
    r = await client.post("/transactions", json={
        "account_id": ids["bank_id"],
        "amount": "-100.00",
        "type": "expense",
        "date": "2026-02-19",
    })
    assert r.status_code == 422


async def test_list_transactions_returns_total(client, user_and_accounts):
    ids = user_and_accounts
    for i in range(3):
        await client.post("/transactions", json={
            "account_id": ids["bank_id"], "amount": "100.00",
            "type": "expense", "date": "2026-02-01",
            "description": f"Expense {i}",
        })
    r = await client.get("/transactions?limit=2&offset=0")
    assert r.status_code == 200
    data = r.json()
    assert "total" in data
    assert "items" in data
    assert data["total"] == 3
    assert len(data["items"]) == 2


async def test_search_transactions_by_description(client, user_and_accounts):
    ids = user_and_accounts
    await client.post("/transactions", json={
        "account_id": ids["bank_id"], "amount": "500.00",
        "type": "expense", "date": "2026-02-01",
        "description": "Jollibee lunch",
    })
    await client.post("/transactions", json={
        "account_id": ids["bank_id"], "amount": "200.00",
        "type": "expense", "date": "2026-02-01",
        "description": "Mercury Drug",
    })
    r = await client.get("/transactions?search=jollibee")
    assert r.status_code == 200
    assert len(r.json()["items"]) == 1
    assert r.json()["items"][0]["description"] == "Jollibee lunch"


async def test_search_transactions_case_insensitive(client, user_and_accounts):
    ids = user_and_accounts
    await client.post("/transactions", json={
        "account_id": ids["bank_id"], "amount": "500.00",
        "type": "expense", "date": "2026-02-01",
        "description": "Grab Food order",
    })
    r = await client.get("/transactions?search=grab food")
    assert r.status_code == 200
    assert len(r.json()["items"]) == 1


async def test_search_transactions_no_match(client, user_and_accounts):
    ids = user_and_accounts
    r = await client.get("/transactions?search=nonexistent")
    assert r.status_code == 200
    assert r.json()["items"] == []
