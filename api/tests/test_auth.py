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


@pytest.mark.asyncio
async def test_change_password_success(client):
    await client.post("/auth/register", json={
        "email": "changepw@example.com", "name": "PW User", "password": "oldpassword1"
    })
    r = await client.post("/auth/change-password", json={
        "current_password": "oldpassword1",
        "new_password": "newpassword1",
    })
    assert r.status_code == 200
    # Verify new password works
    await client.post("/auth/logout")
    r2 = await client.post("/auth/login", json={
        "email": "changepw@example.com", "password": "newpassword1"
    })
    assert r2.status_code == 200


@pytest.mark.asyncio
async def test_change_password_wrong_current(client):
    await client.post("/auth/register", json={
        "email": "wrongpw@example.com", "name": "Wrong PW", "password": "correctpass1"
    })
    r = await client.post("/auth/change-password", json={
        "current_password": "wrongpassword",
        "new_password": "newpassword1",
    })
    assert r.status_code == 400
    assert "incorrect" in r.json()["detail"].lower()


@pytest.mark.asyncio
async def test_refresh_issues_new_access_token(client):
    await client.post("/auth/register", json={
        "email": "refresh@test.com", "name": "R", "password": "password123"
    })
    r = await client.post("/auth/refresh")
    assert r.status_code == 200
    assert r.json()["email"] == "refresh@test.com"


@pytest.mark.asyncio
async def test_refresh_without_token(client):
    r = await client.post("/auth/refresh")
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_login_with_remember_me(client):
    await client.post("/auth/register", json={
        "email": "remember@test.com", "name": "Rem", "password": "password123"
    })
    r = await client.post("/auth/login", json={
        "email": "remember@test.com", "password": "password123", "remember_me": True
    })
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_login_without_remember_me(client):
    await client.post("/auth/register", json={
        "email": "norem@test.com", "name": "No", "password": "password123"
    })
    r = await client.post("/auth/login", json={
        "email": "norem@test.com", "password": "password123", "remember_me": False
    })
    assert r.status_code == 200
