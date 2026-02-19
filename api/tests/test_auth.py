import pytest


@pytest.mark.asyncio
async def test_register_sets_cookie(client):
    response = await client.post("/auth/register", json={
        "email": "test@example.com",
        "name": "Test User",
        "password": "password123",
    })
    assert response.status_code == 201
    assert "access_token" in response.cookies
    assert response.json()["email"] == "test@example.com"


@pytest.mark.asyncio
async def test_login_sets_cookie(client):
    await client.post("/auth/register", json={
        "email": "login@example.com", "name": "Login", "password": "password123"
    })
    response = await client.post("/auth/login", json={
        "email": "login@example.com", "password": "password123"
    })
    assert response.status_code == 200
    assert "access_token" in response.cookies


@pytest.mark.asyncio
async def test_login_wrong_password(client):
    response = await client.post("/auth/login", json={
        "email": "nobody@example.com", "password": "wrong"
    })
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_me_requires_auth(client):
    response = await client.get("/auth/me")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_me_returns_user(client):
    await client.post("/auth/register", json={
        "email": "me@example.com", "name": "Me", "password": "password123"
    })
    response = await client.get("/auth/me")
    assert response.status_code == 200
    assert response.json()["email"] == "me@example.com"


@pytest.mark.asyncio
async def test_patch_me_updates_name(client):
    await client.post("/auth/register", json={
        "email": "patch@example.com", "name": "Original", "password": "password123"
    })
    r = await client.patch("/auth/me", json={"name": "Updated"})
    assert r.status_code == 200
    assert r.json()["name"] == "Updated"


@pytest.mark.asyncio
async def test_patch_me_requires_auth(client):
    r = await client.patch("/auth/me", json={"name": "Updated"})
    assert r.status_code == 401
