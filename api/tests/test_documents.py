import io
import pytest
import app.core.config as cfg


@pytest.fixture
async def auth_client(client):
    await client.post("/auth/register", json={
        "email": "doc@test.com", "name": "Doc User", "password": "password123"
    })
    return client


async def test_upload_receipt(auth_client, tmp_path, monkeypatch):
    monkeypatch.setattr(cfg.settings, "upload_dir", str(tmp_path))
    r = await auth_client.post(
        "/documents/upload",
        files={"file": ("receipt.jpg", io.BytesIO(b"fake-image"), "image/jpeg")},
        data={"document_type": "receipt"},
    )
    assert r.status_code == 201
    data = r.json()
    assert data["filename"] == "receipt.jpg"
    assert data["document_type"] == "receipt"
    assert data["status"] == "pending"


async def test_upload_rejects_oversized_file(auth_client, tmp_path, monkeypatch):
    monkeypatch.setattr(cfg.settings, "upload_dir", str(tmp_path))
    big = io.BytesIO(b"x" * (11 * 1024 * 1024))  # 11MB
    r = await auth_client.post(
        "/documents/upload",
        files={"file": ("big.jpg", big, "image/jpeg")},
        data={"document_type": "receipt"},
    )
    assert r.status_code == 413


async def test_upload_rejects_unsupported_type(auth_client, tmp_path, monkeypatch):
    monkeypatch.setattr(cfg.settings, "upload_dir", str(tmp_path))
    r = await auth_client.post(
        "/documents/upload",
        files={"file": ("script.exe", io.BytesIO(b"bad"), "application/octet-stream")},
        data={"document_type": "receipt"},
    )
    assert r.status_code == 415


async def test_upload_requires_auth(client, tmp_path, monkeypatch):
    monkeypatch.setattr(cfg.settings, "upload_dir", str(tmp_path))
    r = await client.post(
        "/documents/upload",
        files={"file": ("r.jpg", io.BytesIO(b"x"), "image/jpeg")},
        data={"document_type": "receipt"},
    )
    assert r.status_code == 401
