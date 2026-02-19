# Security Audit (Pre-Commit)

Scan the codebase for leaked secrets and security issues. No running services needed.

## Usage

```
/audit-security          → Full repo security scan
```

Run before committing. Fast, offline, catches issues before they reach git.

**Note:** `/commit` already scans staged changes for secrets. This command is broader — it scans the entire repo and checks security posture, not just staged changes.

## Instructions

### 0. Determine Scope

Check which files have changed:

```bash
git diff --cached --name-only
git diff --name-only
git ls-files --others --exclude-standard
```

**Mode selection:**
- If only `docs/` and/or `.claude/` files changed → **docs-only mode** (Steps 1, 2, 5 only)
- If `api/` or `frontend/` or `k8s/` files changed → **full mode** (all steps)
- If no changes detected (fresh audit) → **full mode**

### 1. Secrets Scan

Scan the entire repo for leaked credentials. Use the Grep tool across all relevant directories (`api/`, `frontend/`, `scripts/`, `docs/`, `k8s/`).

**Search patterns (run as separate Grep calls):**
- Hardcoded passwords: `password\s*=\s*["'][^"']{4,}` in Python/TS files
- JWT secrets: `JWT_SECRET_KEY\s*=\s*["'][^"'changeme]{8,}` (actual values, not placeholders)
- API keys in code: `GEMINI_API_KEY\s*=\s*["'][A-Za-z0-9]{10,}` or `CLAUDE_API_KEY\s*=\s*`
- Discord webhooks: `discord\.com/api/webhooks/\d+`
- Token prefixes: `ghp_`, `sk-`, `AKIA[0-9A-Z]`, `xox[bpras]-`
- Private keys: `-----BEGIN (RSA|EC|OPENSSH) PRIVATE KEY`
- JWT payloads: `eyJ[a-zA-Z0-9+/]{20,}` (base64-encoded JWT tokens)
- Database URLs with credentials: `postgresql\+asyncpg://[^:]+:[^@changeme][^@]+@`

**Known safe patterns (skip these):**
- `changeme`, `your-secret-here`, `replace-me`, `<your-...>` — placeholder values
- `.env.example` file — example file, not committed secrets
- `op://` paths — 1Password references
- `openssl rand` — commands to generate, not actual values
- Field names in code: `password_hash`, `api_key_field`, `secret_key_ref`
- Comments: `# set JWT_SECRET_KEY to...`, docstrings explaining fields
- Test files with obviously fake values: `test_password`, `testkey123`

**Classification:**
- ⛔ CRITICAL — Looks like a real credential value
- ⚠️ WARNING — Uncertain, flag for human review
- SAFE — Matches a known safe pattern

### 2. Sensitive File Types

Check for sensitive files that should never exist in the repo. Use Glob to search:

- `**/.env`, `**/.env.*` (except `.env.example`)
- `**/*.pem`, `**/*.key`, `**/*.p12`
- `**/credentials.json`, `**/secrets.json`
- `**/id_rsa`, `**/id_ed25519`

For each found file:
1. Check if tracked by git: `git ls-files <path>`
2. If tracked → ⛔ CRITICAL
3. If untracked, check `.gitignore`: `git check-ignore <path>`
4. If untracked and not gitignored → ⚠️ WARNING
5. If untracked and gitignored → SAFE

### 3. .env Gitignore Check

Verify `.env` is properly protected:

```bash
git check-ignore .env
git check-ignore api/.env
```

If `.env` is NOT in `.gitignore` → ⛔ CRITICAL

Also verify `.env` is not already tracked:
```bash
git ls-files .env api/.env frontend/.env
```

If tracked → ⛔ CRITICAL

### 4. Hardcoded Secrets in Application Code

Check `api/` Python files and `frontend/` TypeScript files for common patterns:

**Python (api/):**
- `SECRET_KEY = "..."` with a real value (not from env)
- `password = "..."` hardcoded in non-test code
- Database credentials hardcoded in `config.py` or `database.py`
- Any `os.environ.get("KEY", "actual-value")` where the default is a real credential

**TypeScript (frontend/src/):**
- `const apiKey = "..."` with a real value
- Hardcoded base URLs with credentials embedded

**Safe patterns in code:**
- `settings.jwt_secret_key` — reading from config/env
- `os.environ["KEY"]` — required env var, no default
- `os.environ.get("KEY", "")` — empty string default is fine
- `process.env.NEXT_PUBLIC_API_URL` — reading from env

### 5. Docs Secrets Check

Scan `docs/**/*.md` for patterns that look like real credentials:
- `ghp_` followed by 36+ alphanumeric chars — GitHub PAT
- `sk-` followed by 48+ chars — OpenAI/Claude API key
- `AKIA` followed by 16 uppercase alphanumeric — AWS key
- `discord.com/api/webhooks/` followed by numbers — Discord webhook URL
- Long base64/hex strings (40+ chars) near words like "token", "key", "secret"

### 6. K8s Manifests Check (full mode only)

Check `k8s/` directory for secrets committed in plaintext:

- Any `kind: Secret` with `stringData` containing actual values (not references)
- Check that Secret manifests use placeholder values or are gitignored
- Warn if production overlay configs have hardcoded credentials

### 7. Generate Report

**Full mode:**
```
Security Audit
==============
Mode: full

Secrets Scan ........... ✅ PASS (0 findings)
Sensitive Files ........ ✅ PASS (0 sensitive files tracked)
.env Gitignore ......... ✅ PASS (.env properly ignored)
Hardcoded Secrets ...... ✅ PASS (no hardcoded credentials in code)
Docs Secrets ........... ✅ PASS
K8s Manifests .......... ✅ PASS (no plaintext secrets)

Result: PASS (0 critical, 0 warnings)
```

**Docs-only mode:**
```
Security Audit
==============
Mode: docs-only (only docs/ and .claude/ files changed)

Secrets Scan ........... ✅ PASS
Sensitive Files ........ ✅ PASS
.env Gitignore ......... ✅ PASS
Docs Secrets ........... ✅ PASS

⏭️  Skipped: Hardcoded Secrets, K8s Manifests (no code changes)

Result: PASS (0 critical, 0 warnings)
```

**If critical issues found:**
```
Result: ⛔ FAIL (1 critical, 0 warnings)

⛔ DO NOT COMMIT — fix critical issues first:
  api/app/core/config.py:12 — Hardcoded JWT secret value
```

**Severity levels:**
- ⛔ CRITICAL — Real secrets, tracked .env files. Blocks commit.
- ⚠️ WARNING — Uncertain patterns, unprotected .env. Should fix.
- ℹ️ INFO — Best practice suggestions.

**Pass/fail:**
- 0 critical = PASS
- 1+ critical = FAIL (do not commit)

## Important Rules

1. **Read-only** — This command never modifies files
2. **Use Grep tool** — Don't run bash grep for file content scanning
3. **Known safe patterns** — Don't flag placeholder values, field names, or comments
4. **File:line references** — Always include exact location for findings
5. **When unsure** — Flag as ⚠️ WARNING for human review rather than suppressing
