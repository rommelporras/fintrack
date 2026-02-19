# Phase 2: Smart Input — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add document upload, AI prompt generation, and paste-to-parse (JSON + free-form) so users can feed receipts/statements to Claude.ai/Gemini web and import the result into fintrack.

**Architecture:** No AI API keys needed — the user manually pastes content into Claude.ai or Gemini web, copies the structured response, and fintrack parses it (JSON-first, regex fallback). Files are stored locally at `api/uploads/{user_id}/`. The existing `Document` model and `paste_ai` transaction source are the foundation.

**Tech Stack:** FastAPI, SQLAlchemy async, pytest-asyncio, httpx (file upload tests), Next.js 16 App Router, shadcn/ui, TanStack Query.

---

## Task 1: Add `upload_dir` to Settings

**Files:**
- Modify: `api/app/core/config.py`

**Step 1: Add the field**

In `api/app/core/config.py`, add one line inside the `Settings` class after `discord_webhook_url`:

```python
upload_dir: str = "uploads"
```

**Step 2: Create the uploads directory placeholder**

```bash
mkdir -p api/uploads
touch api/uploads/.gitkeep
```

Verify `api/uploads/` is already in `.gitignore` (it is — confirmed).

**Step 3: Commit**

```bash
git add api/app/core/config.py api/uploads/.gitkeep
/commit
```

---

## Task 2: Document Schemas

**Files:**
- Create: `api/app/schemas/document.py`

**Step 1: Write the schema file**

```python
# api/app/schemas/document.py
import uuid
from datetime import datetime
from pydantic import BaseModel
from app.models.document import DocumentType, DocumentStatus


class DocumentResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    filename: str
    file_path: str
    document_type: DocumentType
    status: DocumentStatus
    extracted_data: dict | None
    error_message: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class DocumentUpdate(BaseModel):
    status: DocumentStatus | None = None
    extracted_data: dict | None = None
    error_message: str | None = None
```

**Step 2: Commit**

```bash
git add api/app/schemas/document.py
/commit
```

---

## Task 3: Document Upload Endpoint (TDD)

**Files:**
- Create: `api/app/routers/documents.py`
- Create: `api/tests/test_documents.py`

**Step 1: Write the failing test**

```python
# api/tests/test_documents.py
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
```

**Step 2: Run to confirm it fails**

```bash
cd api && pytest tests/test_documents.py -v
```

Expected: `ImportError` or `404` — router doesn't exist yet.

**Step 3: Write the router**

```python
# api/app/routers/documents.py
import uuid
from pathlib import Path
from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.core.database import get_db
from app.dependencies import get_current_user
from app.models.document import Document, DocumentStatus, DocumentType
from app.models.user import User
from app.schemas.document import DocumentResponse

router = APIRouter(prefix="/documents", tags=["documents"])

ALLOWED_TYPES = {
    "image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"
}
MAX_SIZE = 10 * 1024 * 1024  # 10MB


@router.post("/upload", response_model=DocumentResponse, status_code=201)
async def upload_document(
    file: UploadFile,
    document_type: DocumentType = Form(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    contents = await file.read()
    if len(contents) > MAX_SIZE:
        raise HTTPException(status_code=413, detail="File too large (max 10MB)")
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=415, detail="Unsupported file type")

    ext = Path(file.filename or "file").suffix or ".bin"
    file_name = f"{uuid.uuid4()}{ext}"
    user_dir = Path(settings.upload_dir) / str(current_user.id)
    user_dir.mkdir(parents=True, exist_ok=True)
    file_path = user_dir / file_name
    file_path.write_bytes(contents)

    doc = Document(
        user_id=current_user.id,
        filename=file.filename or file_name,
        file_path=str(file_path),
        document_type=document_type,
        status=DocumentStatus.pending,
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)
    return doc
```

**Step 4: Register router in main.py**

Add to `api/app/main.py`:
```python
from app.routers import documents as documents_router
# ...
app.include_router(documents_router.router)
```

**Step 5: Run tests to verify they pass**

```bash
cd api && pytest tests/test_documents.py -v
```

Expected: 4 PASSED.

**Step 6: Commit**

```bash
git add api/app/routers/documents.py api/app/main.py api/tests/test_documents.py
/commit
```

---

## Task 4: Document List + Fetch Endpoints (TDD)

**Files:**
- Modify: `api/app/routers/documents.py`
- Modify: `api/tests/test_documents.py`

**Step 1: Write the failing tests** (add to `test_documents.py`)

```python
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
```

**Step 2: Run to confirm they fail**

```bash
cd api && pytest tests/test_documents.py::test_list_documents_empty -v
```

Expected: FAIL with `404`.

**Step 3: Add list and fetch endpoints** (append to `documents.py`)

```python
from sqlalchemy import select

@router.get("", response_model=list[DocumentResponse])
async def list_documents(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Document)
        .where(Document.user_id == current_user.id)
        .order_by(Document.created_at.desc())
    )
    return result.scalars().all()


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Document).where(
            Document.id == document_id,
            Document.user_id == current_user.id,
        )
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc
```

**Step 4: Run all document tests**

```bash
cd api && pytest tests/test_documents.py -v
```

Expected: all PASSED.

**Step 5: Commit**

```bash
/commit
```

---

## Task 5: Document Patch Endpoint (TDD)

**Files:**
- Modify: `api/app/routers/documents.py`
- Modify: `api/tests/test_documents.py`

**Step 1: Write the failing test**

```python
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
```

**Step 2: Run to confirm failure**

```bash
cd api && pytest tests/test_documents.py::test_patch_document_status -v
```

**Step 3: Add patch endpoint**

```python
from app.schemas.document import DocumentResponse, DocumentUpdate

@router.patch("/{document_id}", response_model=DocumentResponse)
async def update_document(
    document_id: uuid.UUID,
    data: DocumentUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Document).where(
            Document.id == document_id,
            Document.user_id == current_user.id,
        )
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(doc, field, value)
    await db.commit()
    await db.refresh(doc)
    return doc
```

**Step 4: Run all document tests**

```bash
cd api && pytest tests/test_documents.py -v
```

**Step 5: Commit**

```bash
/commit
```

---

## Task 6: Prompt Generator Service + Endpoint (TDD)

**Files:**
- Create: `api/app/services/prompt.py`
- Create: `api/tests/test_prompt.py`
- Modify: `api/app/routers/documents.py`

**Step 1: Write the failing tests**

```python
# api/tests/test_prompt.py
from app.services.prompt import generate_prompt
from app.models.document import DocumentType


def test_receipt_prompt_contains_json_schema():
    p = generate_prompt(DocumentType.receipt)
    assert "amount" in p
    assert "date" in p
    assert "description" in p
    assert "JSON" in p


def test_cc_statement_prompt_contains_array():
    p = generate_prompt(DocumentType.cc_statement)
    assert "[" in p  # array syntax
    assert "amount" in p


def test_other_prompt_is_generic():
    p = generate_prompt(DocumentType.other)
    assert len(p) > 20
```

**Step 2: Run to confirm failure**

```bash
cd api && pytest tests/test_prompt.py -v
```

**Step 3: Write the service**

```python
# api/app/services/prompt.py
from app.models.document import DocumentType

_RECEIPT_PROMPT = (
    "This is a receipt. Extract the merchant name, total amount in PHP, "
    "transaction date, and suggest a category. "
    'Respond ONLY in JSON (no markdown): '
    '{"amount": 0.00, "date": "YYYY-MM-DD", "description": "", '
    '"type": "expense", "category_hint": ""}'
)

_STATEMENT_PROMPT = (
    "This is a credit card statement. Extract each transaction as an array. "
    'Respond ONLY in JSON (no markdown): '
    '[{"amount": 0.00, "date": "YYYY-MM-DD", "description": "", '
    '"type": "expense", "category_hint": ""}]'
)

_OTHER_PROMPT = (
    "Extract any financial transaction details from this document. "
    'Respond ONLY in JSON (no markdown): '
    '{"amount": 0.00, "date": "YYYY-MM-DD", "description": "", '
    '"type": "expense", "category_hint": ""}'
)

_PROMPTS = {
    DocumentType.receipt: _RECEIPT_PROMPT,
    DocumentType.cc_statement: _STATEMENT_PROMPT,
    DocumentType.other: _OTHER_PROMPT,
}


def generate_prompt(document_type: DocumentType) -> str:
    return _PROMPTS[document_type]
```

**Step 4: Run prompt tests**

```bash
cd api && pytest tests/test_prompt.py -v
```

Expected: 3 PASSED.

**Step 5: Add prompt endpoint** (append to `documents.py`)

```python
from app.services.prompt import generate_prompt

@router.post("/{document_id}/prompt")
async def get_document_prompt(
    document_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Document).where(
            Document.id == document_id,
            Document.user_id == current_user.id,
        )
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"prompt": generate_prompt(doc.document_type)}
```

**Step 6: Write endpoint test** (add to `test_documents.py`)

```python
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
```

**Step 7: Run all tests**

```bash
cd api && pytest tests/test_documents.py tests/test_prompt.py -v
```

**Step 8: Commit**

```bash
/commit
```

---

## Task 7: Parser Service — JSON Detection (TDD)

**Files:**
- Create: `api/app/services/parser.py`
- Create: `api/app/schemas/parse.py`
- Create: `api/tests/test_parse.py`

**Step 1: Write the parse schema**

```python
# api/app/schemas/parse.py
from decimal import Decimal
from typing import Literal
from pydantic import BaseModel


class ParsedTransaction(BaseModel):
    amount: Decimal | None = None
    date: str | None = None          # ISO: YYYY-MM-DD
    description: str | None = None
    type: str | None = None          # income | expense | transfer
    category_hint: str | None = None
    confidence: Literal["high", "medium", "low"]


class BulkParseResponse(BaseModel):
    transactions: list[ParsedTransaction]
    count: int
```

**Step 2: Write the failing tests for JSON parsing**

```python
# api/tests/test_parse.py
from decimal import Decimal
from app.services.parser import parse_text, parse_bulk


def test_parse_valid_json_high_confidence():
    text = '{"amount": 500.00, "date": "2026-02-19", "description": "Jollibee", "type": "expense", "category_hint": "Food"}'
    result = parse_text(text)
    assert result.amount == Decimal("500.00")
    assert result.date == "2026-02-19"
    assert result.description == "Jollibee"
    assert result.type == "expense"
    assert result.confidence == "high"


def test_parse_json_missing_optional_fields_medium_confidence():
    text = '{"amount": 200.00, "date": "2026-02-19"}'
    result = parse_text(text)
    assert result.amount == Decimal("200.00")
    assert result.confidence == "medium"


def test_parse_json_with_string_amount():
    text = '{"amount": "1,500.00", "date": "2026-02-19", "type": "expense"}'
    result = parse_text(text)
    assert result.amount == Decimal("1500.00")
```

**Step 3: Run to confirm failure**

```bash
cd api && pytest tests/test_parse.py::test_parse_valid_json_high_confidence -v
```

**Step 4: Write the parser (JSON path only)**

```python
# api/app/services/parser.py
import json
import re
from decimal import Decimal, InvalidOperation
from datetime import datetime
from app.schemas.parse import ParsedTransaction, BulkParseResponse


def parse_text(text: str) -> ParsedTransaction:
    text = text.strip()
    try:
        data = json.loads(text)
        if isinstance(data, dict):
            return _parse_json_obj(data)
    except (json.JSONDecodeError, ValueError):
        pass
    return _parse_freeform(text)


def parse_bulk(text: str) -> BulkParseResponse:
    text = text.strip()
    try:
        data = json.loads(text)
        if isinstance(data, list):
            results = [_parse_json_obj(item) for item in data if isinstance(item, dict)]
        else:
            results = [_parse_json_obj(data)]
    except (json.JSONDecodeError, ValueError):
        lines = [l.strip() for l in text.split("\n") if l.strip()]
        results = [r for r in (_parse_freeform(l) for l in lines) if r.amount is not None]
    return BulkParseResponse(transactions=results, count=len(results))


def _parse_json_obj(data: dict) -> ParsedTransaction:
    raw_amount = data.get("amount")
    amount = _to_decimal(raw_amount)
    date = _normalize_date(str(data["date"])) if data.get("date") else None
    txn_type = str(data["type"]) if data.get("type") else None
    description = str(data.get("description", "")) or None
    category_hint = str(data["category_hint"]) if data.get("category_hint") else None

    has_all = all(x is not None for x in [amount, date, txn_type])
    confidence = "high" if has_all else "medium"

    return ParsedTransaction(
        amount=amount,
        date=date,
        description=description,
        type=txn_type,
        category_hint=category_hint,
        confidence=confidence,
    )


def _to_decimal(value) -> Decimal | None:
    if value is None:
        return None
    try:
        clean = str(value).replace(",", "").strip()
        return Decimal(clean)
    except InvalidOperation:
        return None


def _normalize_date(raw: str) -> str | None:
    fmts = ["%Y-%m-%d", "%m/%d/%Y", "%m/%d/%y", "%B %d, %Y", "%b %d, %Y",
            "%B %d %Y", "%b %d %Y"]
    for fmt in fmts:
        try:
            return datetime.strptime(raw.strip(), fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


def _parse_freeform(text: str) -> ParsedTransaction:
    amount = _extract_amount(text)
    date = _extract_date(text)
    description = _extract_merchant(text)
    txn_type = _extract_type(text)

    found = sum(1 for x in [amount, date, description, txn_type] if x is not None)
    confidence = "high" if found >= 4 else ("medium" if found >= 3 else "low")

    return ParsedTransaction(
        amount=amount,
        date=date,
        description=description,
        type=txn_type,
        confidence=confidence,
    )


def _extract_amount(text: str) -> Decimal | None:
    for pattern in [r"[₱PHP]\s*([\d,]+\.?\d*)", r"([\d,]+\.\d{2})\s*(?:PHP|peso)"]:
        m = re.search(pattern, text, re.IGNORECASE)
        if m:
            val = m.group(1).replace(",", "")
            try:
                return Decimal(val)
            except InvalidOperation:
                pass
    return None


def _extract_date(text: str) -> str | None:
    patterns = [
        r"\b(\d{4}-\d{2}-\d{2})\b",
        r"\b(\d{1,2}/\d{1,2}/\d{2,4})\b",
        r"\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4})\b",
    ]
    for pattern in patterns:
        m = re.search(pattern, text, re.IGNORECASE)
        if m:
            result = _normalize_date(m.group(1))
            if result:
                return result
    return None


def _extract_merchant(text: str) -> str | None:
    m = re.search(
        r"\bat\s+([A-Z][A-Za-z0-9 &'.,-]{2,40}?)(?:\s+on\b|\s+for\b|\.|$)", text
    )
    if m:
        return m.group(1).strip()
    m = re.search(
        r"\bto\s+([A-Z][A-Za-z0-9 &'.,-]{2,40}?)(?:\s+on\b|\s+dated\b|\.|$)", text
    )
    if m:
        return m.group(1).strip()
    return None


def _extract_type(text: str) -> str | None:
    lower = text.lower()
    if any(w in lower for w in ["debited", "deducted", "paid", "purchased", "charged"]):
        return "expense"
    if any(w in lower for w in ["credited", "received", "deposited", "salary", "payroll"]):
        return "income"
    if any(w in lower for w in ["transferred", "sent to", "transfer to"]):
        return "transfer"
    return None
```

**Step 5: Run JSON tests**

```bash
cd api && pytest tests/test_parse.py -v
```

Expected: 3 PASSED.

**Step 6: Commit**

```bash
git add api/app/schemas/parse.py api/app/services/parser.py api/tests/test_parse.py
/commit
```

---

## Task 8: Parser Service — Free-Form Regex + Bulk (TDD)

**Files:**
- Modify: `api/tests/test_parse.py`

**Step 1: Add free-form and bulk tests**

```python
def test_parse_sms_bank_alert():
    text = "Your BDO account ending 1234 was debited ₱500.00 on Feb 19, 2026 at Jollibee SM North."
    result = parse_text(text)
    assert result.amount == Decimal("500.00")
    assert result.date == "2026-02-19"
    assert result.type == "expense"
    assert result.confidence in ("medium", "high")


def test_parse_email_receipt_credited():
    text = "₱25,000.00 has been credited to your account on 2026-02-15. Payroll from Acme Corp."
    result = parse_text(text)
    assert result.amount == Decimal("25000.00")
    assert result.type == "income"
    assert result.date == "2026-02-15"


def test_parse_low_confidence_gibberish():
    result = parse_text("hello world nothing useful here")
    assert result.confidence == "low"
    assert result.amount is None


def test_parse_bulk_json_array():
    text = '[{"amount": 100, "date": "2026-02-01", "description": "A", "type": "expense"}, {"amount": 200, "date": "2026-02-02", "description": "B", "type": "expense"}]'
    result = parse_bulk(text)
    assert result.count == 2
    assert result.transactions[0].amount == Decimal("100")
    assert result.transactions[1].amount == Decimal("200")


def test_parse_bulk_multiline_sms():
    text = (
        "Debited ₱100.00 at Store A on 2026-02-01.\n"
        "Debited ₱200.00 at Store B on 2026-02-02.\n"
    )
    result = parse_bulk(text)
    assert result.count == 2
```

**Step 2: Run to confirm status**

```bash
cd api && pytest tests/test_parse.py -v
```

Fix any failing tests by adjusting regex patterns in `_extract_merchant` and `_extract_amount` until all pass.

**Step 3: Commit**

```bash
/commit
```

---

## Task 9: Parse Endpoints (TDD)

**Files:**
- Create: `api/app/routers/parse.py`
- Create: `api/tests/test_parse_endpoints.py`
- Modify: `api/app/main.py`

**Step 1: Write the failing tests**

```python
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
```

**Step 2: Run to confirm failure**

```bash
cd api && pytest tests/test_parse_endpoints.py -v
```

**Step 3: Write the router**

```python
# api/app/routers/parse.py
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.parse import ParsedTransaction, BulkParseResponse
from app.services.parser import parse_text, parse_bulk

router = APIRouter(prefix="/parse", tags=["parse"])


class PasteRequest(BaseModel):
    text: str


@router.post("/paste", response_model=ParsedTransaction)
async def parse_paste(
    body: PasteRequest,
    current_user: User = Depends(get_current_user),
):
    return parse_text(body.text)


@router.post("/bulk", response_model=BulkParseResponse)
async def parse_bulk_endpoint(
    body: PasteRequest,
    current_user: User = Depends(get_current_user),
):
    return parse_bulk(body.text)
```

**Step 4: Register in main.py**

```python
from app.routers import parse as parse_router
# ...
app.include_router(parse_router.router)
```

**Step 5: Run all parse endpoint tests**

```bash
cd api && pytest tests/test_parse_endpoints.py -v
```

Expected: 5 PASSED.

**Step 6: Run full test suite to confirm nothing broke**

```bash
cd api && pytest -v
```

Expected: 39+ PASSED, 0 FAILED.

**Step 7: Commit**

```bash
git add api/app/routers/parse.py api/app/main.py api/tests/test_parse_endpoints.py
/commit
```

---

## Task 10: Frontend — Scan Page

**Files:**
- Modify: `frontend/src/app/(dashboard)/scan/page.tsx`

**Step 1: Check what the placeholder currently looks like**

Read `frontend/src/app/(dashboard)/scan/page.tsx` first.

**Step 2: Implement the scan page**

```tsx
"use client";

import { useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { Camera, Upload, Copy, Check } from "lucide-react";

type DocType = "receipt" | "cc_statement" | "other";

export default function ScanPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<DocType>("receipt");
  const [docId, setDocId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback((f: File) => {
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setDocId(null);
    setPrompt(null);
  }, []);

  const handleSave = async () => {
    if (!file) return;
    setSaving(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("document_type", docType);
      const doc = await api.upload("/documents/upload", form);
      setDocId(doc.id);
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleCopyPrompt = async () => {
    if (!docId) return;
    const data = await api.post(`/documents/${docId}/prompt`, {});
    await navigator.clipboard.writeText(data.prompt);
    setPrompt(data.prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-lg mx-auto space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Scan Receipt or Statement</h1>

      <div className="flex gap-3">
        <Button variant="outline" className="flex-1" onClick={() => cameraInputRef.current?.click()}>
          <Camera className="mr-2 h-4 w-4" /> Take Photo
        </Button>
        <Button variant="outline" className="flex-1" onClick={() => fileInputRef.current?.click()}>
          <Upload className="mr-2 h-4 w-4" /> Upload File
        </Button>
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment"
          className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
        <input ref={fileInputRef} type="file" accept="image/*,application/pdf"
          className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
      </div>

      {preview && (
        <Card>
          <CardContent className="pt-4">
            <img src={preview} alt="Preview" className="w-full rounded-md object-contain max-h-64" />
          </CardContent>
        </Card>
      )}

      {file && (
        <Card>
          <CardHeader><CardTitle className="text-base">Document Type</CardTitle></CardHeader>
          <CardContent className="flex gap-3">
            {(["receipt", "cc_statement", "other"] as DocType[]).map(t => (
              <Badge key={t} variant={docType === t ? "default" : "outline"}
                className="cursor-pointer" onClick={() => setDocType(t)}>
                {t === "cc_statement" ? "CC Statement" : t.charAt(0).toUpperCase() + t.slice(1)}
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {file && !docId && (
        <Button className="w-full" onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Document"}
        </Button>
      )}

      {docId && (
        <Button className="w-full" variant="secondary" onClick={handleCopyPrompt}>
          {copied ? <><Check className="mr-2 h-4 w-4" /> Copied!</> : <><Copy className="mr-2 h-4 w-4" /> Copy AI Prompt</>}
        </Button>
      )}

      {docId && (
        <p className="text-sm text-muted-foreground text-center">
          Document saved. Copy the prompt, paste it with your file into Claude.ai or Gemini, then come back to paste the response.
        </p>
      )}
    </div>
  );
}
```

**Step 3: Add `upload` helper to `api.ts`**

The existing `api.ts` in `frontend/src/lib/api.ts` needs a multipart upload method. Add:

```typescript
upload: async (path: string, form: FormData): Promise<Record<string, unknown>> => {
  const res = await fetch(`${getBaseUrl()}${path}`, {
    method: "POST",
    credentials: "include",
    body: form,
    // Do NOT set Content-Type — browser sets multipart boundary automatically
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  return res.json();
},
```

**Step 4: Type-check**

```bash
cd frontend && bun tsc --noEmit
```

Expected: zero errors.

**Step 5: Commit**

```bash
/commit
```

---

## Task 11: Frontend — PasteInput + TransactionConfirm Components

**Files:**
- Create: `frontend/src/components/app/PasteInput.tsx`
- Create: `frontend/src/components/app/TransactionConfirm.tsx`

**Step 1: PasteInput component**

```tsx
// frontend/src/components/app/PasteInput.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";

interface ParsedTransaction {
  amount: string | null;
  date: string | null;
  description: string | null;
  type: string | null;
  category_hint: string | null;
  confidence: "high" | "medium" | "low";
}

interface PasteInputProps {
  onParsed: (result: ParsedTransaction) => void;
  bulk?: boolean;
}

export function PasteInput({ onParsed, bulk = false }: PasteInputProps) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleParse = async () => {
    setLoading(true);
    setError(null);
    try {
      const endpoint = bulk ? "/parse/bulk" : "/parse/paste";
      const result = await api.post(endpoint, { text });
      onParsed(result);
    } catch {
      setError("Failed to parse. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <Textarea
        placeholder="Paste the AI response here (JSON or plain text)..."
        value={text}
        onChange={e => setText(e.target.value)}
        rows={6}
        className="font-mono text-sm"
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button onClick={handleParse} disabled={!text.trim() || loading} className="w-full">
        {loading ? "Parsing..." : "Parse"}
      </Button>
    </div>
  );
}
```

**Step 2: TransactionConfirm component**

```tsx
// frontend/src/components/app/TransactionConfirm.tsx
"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";

interface ParsedTransaction {
  amount: string | null;
  date: string | null;
  description: string | null;
  type: string | null;
  confidence: "high" | "medium" | "low";
}

interface TransactionConfirmProps {
  parsed: ParsedTransaction;
  accountId: string;
  documentId?: string;
  onSuccess: () => void;
}

const confidenceColor = {
  high: "default" as const,
  medium: "secondary" as const,
  low: "destructive" as const,
};

export function TransactionConfirm({ parsed, accountId, documentId, onSuccess }: TransactionConfirmProps) {
  const [amount, setAmount] = useState(parsed.amount ?? "");
  const [date, setDate] = useState(parsed.date ?? "");
  const [description, setDescription] = useState(parsed.description ?? "");
  const [type, setType] = useState(parsed.type ?? "expense");
  const [saving, setSaving] = useState(false);

  const uncertain = parsed.confidence !== "high";

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await api.post("/transactions", {
        account_id: accountId,
        amount,
        date,
        description,
        type,
        source: "paste_ai",
        ...(documentId ? { document_id: documentId } : {}),
      });
      onSuccess();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Confidence:</span>
        <Badge variant={confidenceColor[parsed.confidence]}>{parsed.confidence}</Badge>
        {uncertain && <span className="text-xs text-muted-foreground">Review highlighted fields</span>}
      </div>

      <div className="space-y-3">
        <div>
          <Label>Amount</Label>
          <Input value={amount} onChange={e => setAmount(e.target.value)}
            className={uncertain && !parsed.amount ? "border-amber-400" : ""} />
        </div>
        <div>
          <Label>Date</Label>
          <Input type="date" value={date} onChange={e => setDate(e.target.value)}
            className={uncertain && !parsed.date ? "border-amber-400" : ""} />
        </div>
        <div>
          <Label>Description</Label>
          <Input value={description} onChange={e => setDescription(e.target.value)} />
        </div>
        <div>
          <Label>Type</Label>
          <select value={type} onChange={e => setType(e.target.value)}
            className="w-full border rounded-md px-3 py-2 text-sm">
            <option value="expense">Expense</option>
            <option value="income">Income</option>
            <option value="transfer">Transfer</option>
          </select>
        </div>
      </div>

      <Button className="w-full" onClick={handleSubmit} disabled={saving}>
        {saving ? "Saving..." : "Add Transaction"}
      </Button>
    </div>
  );
}
```

**Step 3: Type-check**

```bash
cd frontend && bun tsc --noEmit
```

**Step 4: Commit**

```bash
/commit
```

---

## Task 12: Frontend — Documents Page

**Files:**
- Modify: `frontend/src/app/(dashboard)/documents/page.tsx`
- Create: `frontend/src/components/app/BulkImportTable.tsx`

**Step 1: BulkImportTable component**

```tsx
// frontend/src/components/app/BulkImportTable.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";

interface ParsedRow {
  amount: string | null;
  date: string | null;
  description: string | null;
  type: string | null;
  confidence: "high" | "medium" | "low";
}

interface BulkImportTableProps {
  rows: ParsedRow[];
  accountId: string;
  documentId?: string;
  onSuccess: (count: number) => void;
}

export function BulkImportTable({ rows, accountId, documentId, onSuccess }: BulkImportTableProps) {
  const [selected, setSelected] = useState<Set<number>>(new Set(rows.map((_, i) => i)));
  const [importing, setImporting] = useState(false);

  const toggle = (i: number) => {
    const next = new Set(selected);
    next.has(i) ? next.delete(i) : next.add(i);
    setSelected(next);
  };

  const handleImport = async () => {
    setImporting(true);
    const toImport = rows.filter((_, i) => selected.has(i));
    await Promise.all(toImport.map(row =>
      api.post("/transactions", {
        account_id: accountId,
        amount: row.amount,
        date: row.date,
        description: row.description ?? "",
        type: row.type ?? "expense",
        source: "paste_ai",
        ...(documentId ? { document_id: documentId } : {}),
      })
    ));
    setImporting(false);
    onSuccess(toImport.length);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="p-2 text-left w-8"></th>
              <th className="p-2 text-left">Date</th>
              <th className="p-2 text-left">Description</th>
              <th className="p-2 text-right">Amount</th>
              <th className="p-2 text-left">Type</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                <td className="p-2">
                  <input type="checkbox" checked={selected.has(i)} onChange={() => toggle(i)} />
                </td>
                <td className="p-2">{row.date ?? <span className="text-amber-500">?</span>}</td>
                <td className="p-2">{row.description ?? "—"}</td>
                <td className="p-2 text-right">₱{row.amount ?? <span className="text-amber-500">?</span>}</td>
                <td className="p-2"><Badge variant="outline">{row.type ?? "?"}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button className="w-full" onClick={handleImport} disabled={importing || selected.size === 0}>
        {importing ? "Importing..." : `Import ${selected.size} transaction${selected.size !== 1 ? "s" : ""}`}
      </Button>
    </div>
  );
}
```

**Step 2: Documents page**

```tsx
// frontend/src/app/(dashboard)/documents/page.tsx
"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PasteInput } from "@/components/app/PasteInput";
import { TransactionConfirm } from "@/components/app/TransactionConfirm";
import { BulkImportTable } from "@/components/app/BulkImportTable";
import { api } from "@/lib/api";
import { FileText, Copy, Check } from "lucide-react";

interface Document {
  id: string;
  filename: string;
  document_type: "receipt" | "cc_statement" | "other";
  status: "pending" | "processing" | "done" | "failed";
  created_at: string;
}

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  processing: "default",
  done: "outline",
  failed: "destructive",
};

export default function DocumentsPage() {
  const [selected, setSelected] = useState<Document | null>(null);
  const [parsed, setParsed] = useState<Record<string, unknown> | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: docs = [], refetch } = useQuery({
    queryKey: ["documents"],
    queryFn: () => api.get("/documents") as Promise<Document[]>,
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts"],
    queryFn: () => api.get("/accounts") as Promise<{ id: string; name: string }[]>,
  });

  const defaultAccount = accounts[0]?.id ?? "";

  const handleCopyPrompt = async (doc: Document) => {
    const data = await api.post(`/documents/${doc.id}/prompt`, {}) as { prompt: string };
    await navigator.clipboard.writeText(data.prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isBulk = selected?.document_type === "cc_statement";

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Documents</h1>
        <Button variant="outline" onClick={() => window.location.href = "/scan"}>+ Upload</Button>
      </div>

      {docs.length === 0 && (
        <p className="text-muted-foreground text-sm">No documents yet. Use the Scan page to upload receipts or statements.</p>
      )}

      <div className="space-y-2">
        {docs.map(doc => (
          <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30 cursor-pointer"
            onClick={() => { setSelected(doc); setParsed(null); }}>
            <div className="flex items-center gap-3">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{doc.filename}</p>
                <p className="text-xs text-muted-foreground">{doc.document_type}</p>
              </div>
            </div>
            <Badge variant={statusVariant[doc.status]}>{doc.status}</Badge>
          </div>
        ))}
      </div>

      <Sheet open={!!selected} onOpenChange={open => { if (!open) setSelected(null); }}>
        <SheetContent className="w-[420px] overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>{selected.filename}</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-4">
                <Button variant="secondary" size="sm" className="w-full"
                  onClick={() => handleCopyPrompt(selected)}>
                  {copied ? <><Check className="mr-2 h-4 w-4" />Copied!</> : <><Copy className="mr-2 h-4 w-4" />Copy AI Prompt</>}
                </Button>

                {!parsed && (
                  <div>
                    <p className="text-sm font-medium mb-2">Paste AI Response</p>
                    <PasteInput bulk={isBulk} onParsed={result => setParsed(result as Record<string, unknown>)} />
                  </div>
                )}

                {parsed && !isBulk && (
                  <TransactionConfirm
                    parsed={parsed as Parameters<typeof TransactionConfirm>[0]["parsed"]}
                    accountId={defaultAccount}
                    documentId={selected.id}
                    onSuccess={() => { setSelected(null); refetch(); }}
                  />
                )}

                {parsed && isBulk && (
                  <BulkImportTable
                    rows={(parsed as { transactions: Parameters<typeof BulkImportTable>[0]["rows"] }).transactions}
                    accountId={defaultAccount}
                    documentId={selected.id}
                    onSuccess={() => { setSelected(null); refetch(); }}
                  />
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
```

**Step 3: Type-check**

```bash
cd frontend && bun tsc --noEmit
```

Fix any type errors before continuing.

**Step 4: Run full API test suite**

```bash
cd api && pytest -v
```

Expected: 39+ PASSED, 0 FAILED.

**Step 5: Commit**

```bash
/commit
```

---

## Final Verification

**Step 1: Run all API tests**

```bash
cd api && pytest -v --tb=short
```

Expected: all PASSED.

**Step 2: TypeScript check**

```bash
cd frontend && bun tsc --noEmit
```

Expected: zero errors.

**Step 3: Verify upload directory is gitignored**

```bash
git status api/uploads/
```

Expected: `api/uploads/` not tracked (only `.gitkeep` if present).

**Step 4: Final commit if anything remains staged**

```bash
git status
/commit  # only if there are uncommitted changes
```
