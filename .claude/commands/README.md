# Expense Tracker — Slash Commands

Custom slash commands for development workflow.

## Available Commands

### `/commit` — Smart Conventional Commit
Analyzes changes and creates a properly formatted conventional commit.

**Usage:** `/commit`

**What it does:**
- Scans staged changes for leaked secrets (blocks commit if found)
- Detects commit type (feat/fix/test/chore/infra/etc.)
- Groups changes by category (API, Frontend, Tests, Infra)
- Generates descriptive message in conventional commit format
- NO AI attribution

---

### `/release` — Automated Release
Creates semantic version tags and GitHub releases.

**Usage:**
```
/release                     # Auto-determine version from commits
/release v0.2.0              # Explicit version, auto-generate title
/release v0.2.0 "Smart Input" # Explicit version and title
```

**What it does:**
- Checks: on main branch, clean working tree, no remote tag collision
- Auto-determines semver bump from commit types (feat→minor, fix→patch)
- Creates annotated git tag with release notes
- Pushes commits + tag to origin
- Creates GitHub release with `gh` CLI
- **Always asks for confirmation before executing**

---

### `/audit-security` — Pre-Commit Security Scan
Scans the entire repo for leaked secrets and security issues.

**Usage:** `/audit-security`

**What it does:**
- Scans all files for real credentials (API keys, tokens, passwords)
- Verifies `.env` is gitignored and not tracked
- Checks for hardcoded secrets in Python and TypeScript code
- Scans docs for credential patterns
- Checks K8s manifests for plaintext secrets
- Reports with file:line references and severity levels

---

## Commit Types

| Type | Use Case | Example |
|------|----------|---------|
| `feat:` | New feature or endpoint | `feat: add credit card due date alerts` |
| `fix:` | Bug fix | `fix: correct ATM fee deducted from balance` |
| `test:` | Tests added/updated | `test: add credit card period edge cases` |
| `refactor:` | Code restructuring | `refactor: extract balance computation to service` |
| `docs:` | Documentation only | `docs: update API setup instructions` |
| `chore:` | Deps, tooling, config | `chore: add ruff to dev dependencies` |
| `infra:` | Docker, K8s, CI/CD | `infra: add postgres StatefulSet manifest` |
| `perf:` | Performance improvement | `perf: add index on transaction date column` |

---

## Typical Workflows

### Feature development
```
# 1. Write code + tests
# 2. /audit-security    — catch secrets before committing
# 3. /commit            — stage and commit with good message
```

### Creating a release
```
# 1. /audit-security    — full repo scan
# 2. /commit            — commit any remaining changes
# 3. /release           — tag, push, GitHub release
```

---

## Semantic Versioning

```
v<MAJOR>.<MINOR>.<PATCH>

MAJOR: Breaking API changes, major architecture shifts
MINOR: New features (new endpoints, pages, Phase completion)
PATCH: Bug fixes, documentation updates, dependency bumps
```

## Security

All write and bash operations are guarded by `.claude/hooks/protect-sensitive.sh`:
- Blocks edits to `.env`, credentials, lock files, production Docker files
- Blocks force push to main/master
- Blocks `DROP DATABASE`
- Warns on Alembic migration edits
