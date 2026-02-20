import io
import pytest
import app.core.config as cfg


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


async def test_list_documents_empty(auth_client):
    r = await auth_client.get("/documents")
    assert r.status_code == 200
    assert r.json() == []


async def test_list_documents_after_upload(auth_client, tmp_path, monkeypatch):
    monkeypatch.setattr(cfg.settings, "upload_dir", str(tmp_path))
    await auth_client.post(
        "/documents/upload",
        files={"file": ("r.jpg", io.BytesIO(b"x"), "image/jpeg")},
        data={"document_type": "receipt"},
    )
    r = await auth_client.get("/documents")
    assert r.status_code == 200
    assert len(r.json()) == 1
    assert r.json()[0]["filename"] == "r.jpg"


async def test_fetch_document_by_id(auth_client, tmp_path, monkeypatch):
    monkeypatch.setattr(cfg.settings, "upload_dir", str(tmp_path))
    up = await auth_client.post(
        "/documents/upload",
        files={"file": ("r.jpg", io.BytesIO(b"x"), "image/jpeg")},
        data={"document_type": "receipt"},
    )
    doc_id = up.json()["id"]
    r = await auth_client.get(f"/documents/{doc_id}")
    assert r.status_code == 200
    assert r.json()["id"] == doc_id


async def test_fetch_document_not_found(auth_client):
    r = await auth_client.get("/documents/00000000-0000-0000-0000-000000000000")
    assert r.status_code == 404


async def test_patch_document_status(auth_client, tmp_path, monkeypatch):
    monkeypatch.setattr(cfg.settings, "upload_dir", str(tmp_path))
    up = await auth_client.post(
        "/documents/upload",
        files={"file": ("r.jpg", io.BytesIO(b"x"), "image/jpeg")},
        data={"document_type": "receipt"},
    )
    doc_id = up.json()["id"]
    r = await auth_client.patch(f"/documents/{doc_id}", json={"status": "done"})
    assert r.status_code == 200
    assert r.json()["status"] == "done"


async def test_get_prompt_for_receipt(auth_client, tmp_path, monkeypatch):
    monkeypatch.setattr(cfg.settings, "upload_dir", str(tmp_path))
    up = await auth_client.post(
        "/documents/upload",
        files={"file": ("r.jpg", io.BytesIO(b"x"), "image/jpeg")},
        data={"document_type": "receipt"},
    )
    doc_id = up.json()["id"]
    r = await auth_client.post(f"/documents/{doc_id}/prompt")
    assert r.status_code == 200
    assert "amount" in r.json()["prompt"]
    assert "JSON" in r.json()["prompt"]
