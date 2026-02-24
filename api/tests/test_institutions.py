import pytest
from httpx import AsyncClient


async def test_list_institutions_empty(auth_client):
    r = await auth_client.get("/institutions")
    assert r.status_code == 200
    assert r.json() == []


async def test_create_institution(auth_client):
    r = await auth_client.post("/institutions", json={
        "name": "BPI",
        "type": "traditional",
        "color": "#e63c2f",
    })
    assert r.status_code == 201
    data = r.json()
    assert data["name"] == "BPI"
    assert data["type"] == "traditional"
    assert data["color"] == "#e63c2f"
    assert "id" in data


async def test_create_institution_minimal(auth_client):
    r = await auth_client.post("/institutions", json={
        "name": "GCash",
        "type": "digital",
    })
    assert r.status_code == 201
    data = r.json()
    assert data["color"] is None


async def test_update_institution(auth_client):
    r = await auth_client.post("/institutions", json={"name": "Maya", "type": "digital"})
    inst_id = r.json()["id"]

    r = await auth_client.patch(f"/institutions/{inst_id}", json={"color": "#0abf53"})
    assert r.status_code == 200
    assert r.json()["color"] == "#0abf53"


async def test_delete_institution(auth_client):
    r = await auth_client.post("/institutions", json={"name": "Temp", "type": "digital"})
    inst_id = r.json()["id"]

    r = await auth_client.delete(f"/institutions/{inst_id}")
    assert r.status_code == 204

    r = await auth_client.get("/institutions")
    assert r.json() == []


async def test_delete_institution_blocked_when_referenced(auth_client):
    r = await auth_client.post("/institutions", json={"name": "BDO", "type": "traditional"})
    inst_id = r.json()["id"]

    # Link an account to this institution
    await auth_client.post("/accounts", json={
        "name": "BDO Savings",
        "type": "savings",
        "institution_id": inst_id,
    })

    r = await auth_client.delete(f"/institutions/{inst_id}")
    assert r.status_code == 409


async def test_institutions_require_auth(client):
    r = await client.get("/institutions")
    assert r.status_code == 401
