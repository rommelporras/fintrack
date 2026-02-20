import uuid


async def test_list_categories(auth_client):
    """List returns empty initially, then includes created categories."""
    r = await auth_client.get("/categories")
    assert r.status_code == 200
    assert isinstance(r.json(), list)

    # Create one so we can verify it shows up
    await auth_client.post("/categories", json={
        "name": "TestList", "type": "expense", "icon": "tag", "color": "#123456"
    })
    r2 = await auth_client.get("/categories")
    assert any(c["name"] == "TestList" for c in r2.json())


async def test_create_expense_category(auth_client):
    r = await auth_client.post("/categories", json={
        "name": "Groceries", "type": "expense", "icon": "shopping-cart", "color": "#00FF00"
    })
    assert r.status_code == 201
    data = r.json()
    assert data["name"] == "Groceries"
    assert data["type"] == "expense"
    assert data["is_system"] is False


async def test_create_income_category(auth_client):
    r = await auth_client.post("/categories", json={
        "name": "Freelance", "type": "income", "icon": "briefcase", "color": "#0000FF"
    })
    assert r.status_code == 201
    assert r.json()["type"] == "income"


async def test_create_category_invalid_type(auth_client):
    r = await auth_client.post("/categories", json={
        "name": "Bad", "type": "invalid_type", "icon": "x", "color": "#000000"
    })
    assert r.status_code == 422


async def test_delete_custom_category(auth_client):
    r = await auth_client.post("/categories", json={
        "name": "ToDelete", "type": "expense", "icon": "trash", "color": "#FF0000"
    })
    cat_id = r.json()["id"]
    del_r = await auth_client.delete(f"/categories/{cat_id}")
    assert del_r.status_code == 204


async def test_delete_nonexistent_category(auth_client):
    fake_id = str(uuid.uuid4())
    r = await auth_client.delete(f"/categories/{fake_id}")
    assert r.status_code == 404


async def test_categories_require_auth(client):
    r = await client.get("/categories")
    assert r.status_code == 401
