import uuid
import pytest_asyncio
from httpx import AsyncClient


@pytest_asyncio.fixture
async def cc_account_id(auth_client: AsyncClient) -> str:
    """Create a credit_card-type account for credit card tests."""
    r = await auth_client.post("/accounts", json={
        "name": "BPI Credit", "type": "credit_card"
    })
    assert r.status_code == 201
    return r.json()["id"]


async def test_list_credit_cards_empty(auth_client):
    r = await auth_client.get("/credit-cards")
    assert r.status_code == 200
    assert r.json() == []


async def test_create_credit_card(auth_client, cc_account_id):
    r = await auth_client.post("/credit-cards", json={
        "account_id": cc_account_id,
        "bank_name": "BPI",
        "last_four": "1234",
        "credit_limit": "50000.00",
        "statement_day": 15,
        "due_day": 5,
    })
    assert r.status_code == 201
    data = r.json()
    assert data["bank_name"] == "BPI"
    assert data["last_four"] == "1234"
    assert "closed_period" in data
    assert "due_date" in data
    assert data["credit_line_id"] is None
    assert data["card_name"] is None
    assert data["available_credit"] == "50000.00"


async def test_create_credit_card_with_card_name(auth_client, cc_account_id):
    r = await auth_client.post("/credit-cards", json={
        "account_id": cc_account_id,
        "bank_name": "RCBC",
        "last_four": "4321",
        "credit_limit": "30000.00",
        "card_name": "Gold",
        "statement_day": 20,
        "due_day": 10,
    })
    assert r.status_code == 201
    data = r.json()
    assert data["card_name"] == "Gold"
    assert data["available_credit"] == "30000.00"


async def test_create_credit_card_invalid_last_four(auth_client, cc_account_id):
    r = await auth_client.post("/credit-cards", json={
        "account_id": cc_account_id,
        "bank_name": "BPI",
        "last_four": "12AB",
        "statement_day": 15,
        "due_day": 5,
    })
    assert r.status_code == 422


async def test_create_credit_card_invalid_statement_day(auth_client, cc_account_id):
    r = await auth_client.post("/credit-cards", json={
        "account_id": cc_account_id,
        "bank_name": "BPI",
        "last_four": "5678",
        "statement_day": 31,
        "due_day": 5,
    })
    assert r.status_code == 422


async def test_update_credit_card(auth_client, cc_account_id):
    r = await auth_client.post("/credit-cards", json={
        "account_id": cc_account_id,
        "bank_name": "BPI",
        "last_four": "9999",
        "statement_day": 10,
        "due_day": 1,
    })
    card_id = r.json()["id"]
    r2 = await auth_client.patch(f"/credit-cards/{card_id}", json={
        "bank_name": "Metrobank"
    })
    assert r2.status_code == 200
    assert r2.json()["bank_name"] == "Metrobank"


async def test_delete_credit_card(auth_client, cc_account_id):
    r = await auth_client.post("/credit-cards", json={
        "account_id": cc_account_id,
        "bank_name": "Delete Me",
        "last_four": "0000",
        "statement_day": 20,
        "due_day": 10,
    })
    card_id = r.json()["id"]
    del_r = await auth_client.delete(f"/credit-cards/{card_id}")
    assert del_r.status_code == 204


async def test_delete_credit_card_not_found(auth_client):
    fake_id = str(uuid.uuid4())
    r = await auth_client.delete(f"/credit-cards/{fake_id}")
    assert r.status_code == 404


async def test_credit_cards_require_auth(client):
    r = await client.get("/credit-cards")
    assert r.status_code == 401
