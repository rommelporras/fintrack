import pytest
from datetime import date, timedelta

from app.models.recurring_transaction import RecurrenceFrequency
from app.services.recurring import advance_date


@pytest.fixture
async def user_and_account(client):
    """Register a user and create an account."""
    await client.post(
        "/auth/register",
        json={"email": "rec@test.com", "name": "Rec User", "password": "password123"},
    )
    acct = await client.post(
        "/accounts",
        json={"name": "BDO Savings", "type": "savings", "opening_balance": "10000.00"},
    )
    return {"account_id": acct.json()["id"]}


async def test_list_recurring_empty(client, user_and_account):
    r = await client.get("/recurring-transactions")
    assert r.status_code == 200
    assert r.json() == []


async def test_create_recurring(client, user_and_account):
    ids = user_and_account
    r = await client.post(
        "/recurring-transactions",
        json={
            "account_id": ids["account_id"],
            "amount": "1500.00",
            "description": "Netflix",
            "type": "expense",
            "sub_type": "subscription",
            "frequency": "monthly",
            "start_date": "2026-03-01",
        },
    )
    assert r.status_code == 201
    data = r.json()
    assert data["amount"] == "1500.00"
    assert data["frequency"] == "monthly"
    assert data["next_due_date"] == "2026-03-01"
    assert data["is_active"] is True


async def test_create_recurring_invalid_amount(client, user_and_account):
    ids = user_and_account
    r = await client.post(
        "/recurring-transactions",
        json={
            "account_id": ids["account_id"],
            "amount": "-100.00",
            "type": "expense",
            "frequency": "monthly",
            "start_date": "2026-03-01",
        },
    )
    assert r.status_code == 422


async def test_update_recurring(client, user_and_account):
    ids = user_and_account
    create = await client.post(
        "/recurring-transactions",
        json={
            "account_id": ids["account_id"],
            "amount": "500.00",
            "description": "Spotify",
            "type": "expense",
            "sub_type": "subscription",
            "frequency": "monthly",
            "start_date": "2026-03-01",
        },
    )
    rec_id = create.json()["id"]
    r = await client.patch(
        f"/recurring-transactions/{rec_id}",
        json={"amount": "600.00", "description": "Spotify Premium"},
    )
    assert r.status_code == 200
    assert r.json()["amount"] == "600.00"
    assert r.json()["description"] == "Spotify Premium"


async def test_delete_recurring(client, user_and_account):
    ids = user_and_account
    create = await client.post(
        "/recurring-transactions",
        json={
            "account_id": ids["account_id"],
            "amount": "200.00",
            "type": "expense",
            "frequency": "weekly",
            "start_date": "2026-03-01",
        },
    )
    rec_id = create.json()["id"]
    r = await client.delete(f"/recurring-transactions/{rec_id}")
    assert r.status_code == 204

    listing = await client.get("/recurring-transactions")
    assert len(listing.json()) == 0


async def test_pause_resume_recurring(client, user_and_account):
    ids = user_and_account
    create = await client.post(
        "/recurring-transactions",
        json={
            "account_id": ids["account_id"],
            "amount": "100.00",
            "type": "expense",
            "frequency": "daily",
            "start_date": "2026-03-01",
        },
    )
    rec_id = create.json()["id"]
    # Pause
    r = await client.patch(
        f"/recurring-transactions/{rec_id}", json={"is_active": False}
    )
    assert r.json()["is_active"] is False
    # Resume
    r = await client.patch(
        f"/recurring-transactions/{rec_id}", json={"is_active": True}
    )
    assert r.json()["is_active"] is True


async def test_recurring_requires_auth(client):
    r = await client.get("/recurring-transactions")
    assert r.status_code == 401


def test_advance_date_monthly():
    d = date(2026, 1, 31)
    result = advance_date(d, RecurrenceFrequency.monthly)
    assert result == date(2026, 2, 28)


def test_advance_date_yearly():
    d = date(2026, 3, 1)
    result = advance_date(d, RecurrenceFrequency.yearly)
    assert result == date(2027, 3, 1)
