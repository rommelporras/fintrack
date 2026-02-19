# Create Release

Create a version tag, push commits and tag, and create a GitHub release.

## Usage

```
/release                      → Auto-determine version from commits
/release v0.1.0               → Explicit version, auto-generate title
/release v0.1.0 "Title Here"  → Explicit version AND title
```

## Instructions

1. **Check Current State**

   ```bash
   git branch --show-current   # Must be on main
   git status                  # Must be clean working tree
   git log --oneline -5        # Recent commits
   git describe --tags --abbrev=0 2>/dev/null || echo "No tags yet"
   ```

   - **Must be on `main`** — abort if on any other branch
   - Working tree **must be clean** — abort if dirty

2. **Remote Tag Collision Check**

   ```bash
   git fetch origin --tags
   git tag -l "v<VERSION>"
   ```

   If tag already exists on remote: **ABORT** and suggest the next available version.

3. **Determine Version and Title**

   Full release title format: `v<VERSION> - <Short Title>` (regular hyphen, NOT em dash)

   **If user provided version + title** (`/release v1.0.0 "Phase 1 Complete"`):
   - Full title: `v1.0.0 - Phase 1 Complete`

   **If user provided version only** (`/release v1.0.0`):
   - Auto-generate `<Short Title>` from commit analysis

   **If no version provided** (`/release`):
   - Find last tag, analyze commits since last tag
   - Auto-bump version:
     - `feat:` → **minor** bump (v0.1.0 → v0.2.0)
     - `fix:` only → **patch** bump (v0.1.0 → v0.1.1)
     - `BREAKING CHANGE` → **major** bump (v0.1.0 → v1.0.0)
     - `docs:`, `chore:` only → **patch** bump
   - Auto-generate `<Short Title>` from commit analysis
   - **First release** (no previous tags): default to `v0.1.0`

4. **Analyze Changes for Release Notes**

   Group commits by category:
   - Features (new endpoints, UI pages, models)
   - Bug fixes
   - Infrastructure / Docker / K8s
   - Tests
   - Chores / Dependencies

   Understand the PURPOSE, not just list commits.

5. **Write Release Notes**

   **Tag annotation:**
   ```
   v<VERSION> - <Short Title>

   <One sentence summary of this release>

   <Category 1>:
   - Specific item

   <Category 2>:
   - Specific item
   ```

   **GitHub release body:**
   ```markdown
   ## Summary
   <One paragraph describing what this release contains>

   ## What's Included

   ### <Category 1>
   - Item 1
   - Item 2

   ## Commits
   - `abc1234` commit message 1
   - `def5678` commit message 2
   ```

6. **Show Release Plan and Confirm**

   Present the full plan and **wait for user confirmation**:
   ```
   Release Plan:
   - Version: v0.1.0
   - Title: "v0.1.0 - <Short Title>"
   - Commits: <N> (since <last-tag or beginning>)
   - Will push to: origin/main
   - Will create: Annotated tag v<VERSION>
   - Will create: GitHub release

   Pre-release checks:
   - Remote tag collision: ✓ No conflict
   - Working tree: ✓ Clean
   - Branch: ✓ main

   Proceed with release? (waiting for confirmation)
   ```

   **Do NOT proceed until user confirms.**

7. **Execute Release**

   ```bash
   # Create annotated tag
   git tag -a v<VERSION> -m "<tag annotation>"

   # Push commits
   git push origin main

   # Push tag
   git push origin v<VERSION>

   # Create GitHub release
   gh release create v<VERSION> \
     --title "v<VERSION> - <Short Title>" \
     --notes "<release notes>"
   ```

8. **Report Results**
   ```
   Release Complete:
   - Version: v<VERSION>
   - Tag: pushed to origin
   - GitHub release: <URL>
   ```

## Examples

### First release
```
v0.1.0 - Core Backend

Foundation: auth, accounts, credit cards, categories, transactions.

API:
- JWT auth with httpOnly cookies (register, login, logout)
- Account management with computed balance
- CreditCard with statement period service
- Transaction CRUD with pagination and ATM fee support

Infrastructure:
- Docker Compose for local development
- Alembic migrations with category seed data
```

### Feature release (minor bump)
```
v0.2.0 - Smart Input

Receipt capture and credit card PDF upload with AI extraction.

Features:
- Receipt photo capture (mobile camera API)
- Manual paste mode for Gemini/Claude web
- PDF upload with password support (PyMuPDF)
- Document processing via Celery workers
```

### Patch release
```
v0.1.1 - Auth Fix

Fix refresh token not being cleared on logout.

Fixes:
- Delete both access_token and refresh_token cookies on logout
```

## Quality Checklist

- [ ] On `main` branch
- [ ] Working tree is clean
- [ ] Remote tags fetched, no version collision
- [ ] All commits meaningful and well-formatted
- [ ] Version follows SemVer
- [ ] Release notes are categorized and specific
- [ ] Tag annotation has context sentence
- [ ] GitHub release has full summary
- [ ] **User confirmed release plan before execution**

## Important Notes

- NEVER release with uncommitted changes
- NEVER release without user confirmation
- Always use annotated tags (`git tag -a`)
- Always fetch remote tags first
- Title format: `v<VERSION> - <Short Title>` — regular hyphen, NEVER em dash
- Keep titles concise: 2-4 words ("Core Backend", "Smart Input", "Auth Fix")
- NO AI attribution in release notes
