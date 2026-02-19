# api/tests/test_parse_endpoints.py
import pytest


@pytest.fixture
async def auth_client(client):
    await client.post("/auth/register", json={
        "email": "parse@test.com", "name": "Parse User", "password": "password123"
    })
    return client


async def test_parse_paste_json(auth_client):
    r = await auth_client.post("/parse/paste", json={
        "text": '{"amount": 500, "date": "2026-02-19", "description": "Lunch", "type": "expense"}'
    })
    assert r.status_code == 200
    data = r.json()
    assert data["amount"] == "500"
    assert data["confidence"] == "high"


async def test_parse_paste_freeform(auth_client):
    r = await auth_client.post("/parse/paste", json={
        "text": "Your BDO account was debited ₱350.00 on Feb 19, 2026 at Jollibee."
    })
    assert r.status_code == 200
    assert r.json()["amount"] == "350.00"
    assert r.json()["type"] == "expense"


async def test_parse_paste_requires_auth(client):
    r = await client.post("/parse/paste", json={"text": "anything"})
    assert r.status_code == 401


async def test_parse_bulk_json(auth_client):
    r = await auth_client.post("/parse/bulk", json={
        "text": '[{"amount": 100, "date": "2026-02-01", "type": "expense"}, {"amount": 200, "date": "2026-02-02", "type": "expense"}]'
    })
    assert r.status_code == 200
    assert r.json()["count"] == 2


async def test_parse_bulk_requires_auth(client):
    r = await client.post("/parse/bulk", json={"text": "[]"})
    assert r.status_code == 401
