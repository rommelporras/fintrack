# Phase 2: Smart Input — Design Doc

**Date:** 2026-02-19
**Status:** Approved

---

## Overview

Phase 2 adds smart transaction input via three surfaces: a scan page (camera/file upload), a paste-to-parse input (AI response → transaction fields), and a documents page (stored receipts/statements). No AI API keys are required — the AI step is manual (user pastes content into Claude.ai or Gemini web, copies the response back into fintrack).

---

## Goals

- Store receipts and PDF statements as documents
- Generate copy-ready AI prompts tailored to document type
- Parse AI responses (JSON or free-form text) into pre-filled transaction forms
- Support bulk import for CC statement line items
- Cover everything with TDD (API tests written first, then implementation)

---

## Architecture

```
User
 ├── Scan page     → camera / file upload → Document stored → "Copy AI Prompt" → paste to Claude.ai/Gemini
 ├── Paste input   → paste AI response (JSON or free-form) → parser → confirmation form → Transaction(s) created
 └── Documents page → list stored docs → re-generate prompt → paste response → link to transactions
```

No new AI infrastructure. The existing `process_document` Celery stub stays unchanged. The `Document` model, `paste_ai` transaction source, and `/app/uploads/` volume mount from Phase 1 are the foundation.

---

## API Endpoints (new)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/documents/upload` | Store file, return Document record |
| `GET` | `/documents` | List user's documents (paginated) |
| `GET` | `/documents/{id}` | Fetch single document |
| `POST` | `/documents/{id}/prompt` | Generate AI prompt for clipboard |
| `PATCH` | `/documents/{id}` | Update status, link transaction |
| `POST` | `/parse/paste` | Parse single transaction from text/JSON |
| `POST` | `/parse/bulk` | Parse multi-transaction text/JSON → array |

---

## Section 1 — Paste-to-Parse Parser

### Detection Logic

```
input text
  ├── valid JSON?  → parse against TransactionSchema, fill matched fields
  └── free-form?   → regex heuristics:
        ├── amount   → ₱#,###.## or PHP #,###
        ├── date     → Feb 19, 2026 / 02/19/26 / 2026-02-19
        ├── merchant → "at [MERCHANT]" or "to [NAME]"
        └── type     → "debited"→expense, "credited"→income, "transfer"→transfer
```

### Expected JSON Schema

When prompting the AI, users are directed to request this format:

```json
{
  "amount": 500.00,
  "date": "2026-02-19",
  "description": "Jollibee SM Megamall",
  "type": "expense",
  "category_hint": "Food & Drinks"
}
```

### Confidence Scoring

Every parse response includes a `confidence` field:

- `high` — JSON input with all required fields present
- `medium` — JSON with missing optional fields, or free-form with 3+ fields matched
- `low` — free-form with fewer than 3 fields matched

The frontend highlights uncertain fields in amber for user review.

### Bulk Variant

`POST /parse/bulk` returns an array of the same shape. Used for CC statement line items. User reviews all rows in a table before confirming batch import.

---

## Section 2 — Scan Page + Document Storage

### UX

```
┌─────────────────────────────────────┐
│  [📷 Take Photo]  [🖼 Upload File]  │
│                                     │
│  ── or drag & drop ──               │
│                                     │
│  [preview of captured/selected file]│
│                                     │
│  Type: ○ Receipt  ○ CC Statement    │
│                                     │
│  [💾 Save Document]                 │
│  [📋 Copy AI Prompt]                │
└─────────────────────────────────────┘
```

### Flow

1. User captures via camera (`getUserMedia`) or uploads file → client-side preview
2. "Save Document" → `POST /documents/upload` → stored at `/app/uploads/{user_id}/{uuid}.{ext}`
3. "Copy AI Prompt" → `POST /documents/{id}/prompt` → prompt copied to clipboard
4. User pastes into Claude.ai or Gemini web → copies AI response → goes to paste input

### Prompt Templates (server-generated)

**Receipt:**
> This is a receipt. Extract the merchant name, amount in PHP, date, and suggest a category. Respond only in JSON: `{"amount": 0.00, "date": "YYYY-MM-DD", "description": "", "type": "expense", "category_hint": ""}`

**CC Statement:**
> This is a credit card statement. Extract each transaction as an array. Respond only in JSON: `[{"amount": 0.00, "date": "YYYY-MM-DD", "description": "", "type": "expense", "category_hint": ""}]`

### Storage Constraints

- Location: `api/uploads/{user_id}/` (already volume-mounted in docker-compose)
- `uploads/` added to `.gitignore`
- Max file size: 10MB
- Accepted types: `image/*`, `application/pdf`

---

## Section 3 — Documents Page + Transaction Linking

### Documents List

```
┌──────────────────────────────────────────────────┐
│  Documents                          [+ Upload]   │
│                                                  │
│  receipt_feb19.jpg   Receipt    ● Pending   [▸]  │
│  bdo_jan2026.pdf     Statement  ● Done      [▸]  │
│  gcash_sms.png       Receipt    ● Pending   [▸]  │
└──────────────────────────────────────────────────┘
```

### Document Detail (slide-over)

- File preview (image) or filename (PDF)
- Status badge: `pending → done`
- "Copy AI Prompt" button — re-generates prompt anytime
- Inline "Paste AI Response" textarea → runs `/parse/paste` or `/parse/bulk`
- Linked transactions list

### Single Transaction Confirmation

- Pre-filled form from parsed fields
- Uncertain fields highlighted in amber
- User selects account, adjusts category if needed
- Submit → `POST /transactions` with `source: paste_ai`, `document_id` linked

### Bulk Import Confirmation (CC Statement)

- Table of extracted rows: amount, date, description, category
- Checkbox per row to deselect incorrect entries
- "Import X transactions" → batch `POST /transactions`

---

## Section 4 — Prompt Generator

A `POST /documents/{id}/prompt` endpoint returns a tailored prompt string based on `document_type`:

- `receipt` → single-transaction JSON prompt
- `cc_statement` → multi-transaction array JSON prompt
- `other` → generic extraction prompt

The frontend copies this to clipboard automatically. No file content is sent to any AI — the user manually pastes the prompt + file into Claude.ai/Gemini web themselves.

---

## Testing Strategy

### API Tests (TDD — written first)

| File | Covers |
|------|--------|
| `test_documents.py` | upload, list, fetch, prompt generation, 10MB limit, invalid type |
| `test_parse_paste.py` | JSON detection, SMS free-form, email free-form, confidence levels, invalid input |
| `test_parse_bulk.py` | multi-row JSON, partial rows |
| `test_transactions_source.py` | `paste_ai` source, `document_id` linking |

Target: ~20 new tests on top of Phase 1's 29.

### Frontend Tests (Playwright)

- Scan page: camera button, file upload, preview, copy prompt
- Paste input: JSON → fields pre-filled, free-form → fields pre-filled with confidence highlights
- Bulk table: checkboxes, import count

### TDD Order (per feature)

1. Write failing test
2. Minimum implementation to pass
3. Refactor
4. Next test

---

## Out of Scope (Phase 2)

- AI API integration (Claude API, Gemini API) — deferred, no budget
- Automatic OCR without manual AI step
- Real-time streaming extraction
- Mobile app / PWA push notifications

---

## File Changes Summary

**Backend (api/):**
- `app/routers/documents.py` — new
- `app/routers/parse.py` — new
- `app/services/parser.py` — JSON + regex extraction logic
- `app/services/prompt.py` — prompt template generator
- `app/schemas/document.py` — new
- `app/schemas/parse.py` — new
- `app/main.py` — register new routers
- `migrations/versions/` — none needed (Document model exists)
- `tests/test_documents.py` — new
- `tests/test_parse_paste.py` — new
- `tests/test_parse_bulk.py` — new

**Frontend (frontend/src/):**
- `app/(dashboard)/scan/page.tsx` — implement (was placeholder)
- `app/(dashboard)/documents/page.tsx` — implement (was placeholder)
- `components/app/PasteInput.tsx` — new
- `components/app/TransactionConfirm.tsx` — new
- `components/app/BulkImportTable.tsx` — new
