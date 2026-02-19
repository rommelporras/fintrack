# Smart Conventional Commit

Analyze the current git changes and create a well-structured conventional commit.

## Usage

```
/commit              → Auto-analyze and auto-generate commit message
```

No arguments needed. The command analyzes git diff and generates the appropriate message.

## Instructions

1. **Check Git Status**
   - Run `git status` to see modified files
   - Run `git diff` to see actual changes (or `git diff --cached` if staged)

2. **Secrets Gate (BLOCKING)**

   Before analyzing changes, scan the diff for leaked secrets. This is a **hard gate** — do not proceed to commit if real secrets are found.

   ```bash
   git diff HEAD | grep -inE \
     '(password|secret|token|api[_-]?key|credential|bearer|private[_-]?key|-----BEGIN|webhook\.com|discord\.com/api|ghp_|sk-|AKIA[0-9A-Z]|eyJ[a-zA-Z0-9])'
   ```

   **Known safe patterns (ignore these):**
   - `JWT_SECRET_KEY=changeme` or `=your-secret-here` — example/placeholder values
   - `op://` paths — 1Password reference URIs
   - `secretKeyRef` / `secretName` — K8s references to Secret objects
   - `openssl rand` — instructions to generate, not actual values
   - Field name references like `password_hash`, `api_key` in code/docs
   - Words like "JWT token", "API key" in descriptive prose or comments
   - `.env.example` with placeholder values

   **Report format:**
   ```
   Secrets Scan
   ============
   Matches: <N>
   All safe: ✓ (known patterns only)
   ```

   OR if real secrets found:
   ```
   Secrets Scan
   ============
   ⛔ BLOCKED — Real secret detected:
     <file>:<line> — <description>

   Remove the secret and try again.
   ```

   **If blocked:** Do NOT proceed. Tell the user which file/line has the leak.

3. **Detect Commit Type** (only after secrets gate passes)
   - `feat:` — New feature or endpoint
   - `fix:` — Bug fix
   - `docs:` — Documentation changes only
   - `style:` — Formatting, whitespace (no logic change)
   - `refactor:` — Code restructuring without behavior change
   - `perf:` — Performance improvements
   - `test:` — Adding or updating tests
   - `chore:` — Build, dependencies, tooling, config
   - `infra:` — Docker, K8s manifests, CI/CD

4. **Analyze and Group Changes**
   - Identify what categories of files changed (api, frontend, tests, infra, docs)
   - Group related changes together
   - Understand the PURPOSE of changes, not just what files changed

5. **Write Commit Message**

   Format (NO AI attribution):
   ```
   <type>: <short summary (50 chars max)>

   <One sentence context — what is this change about?>

   <Category 1>:
   - Specific change 1
   - Specific change 2

   <Category 2>:
   - Specific change 1
   ```

   **Structure rules:**
   - Title: 50 chars max, imperative mood ("Add" not "Added")
   - Context: One sentence explaining the purpose
   - Categories: Group changes logically (API, Frontend, Tests, etc.)
   - Bullets: Specific items under each category
   - Simple changes don't need categories — just context + bullets

6. **Execute Commit**
   ```bash
   git add .
   git commit -m "$(cat <<'EOF'
   [commit message here]
   EOF
   )"
   ```

7. **Show Status**
   Run `git status` and `git log --oneline -1` to confirm

## Examples

**Simple (single change):**
```
fix: reject duplicate email on register

Return 400 instead of 500 when email already exists.
```

**API feature:**
```
feat: add transaction pagination

Default limit 50, max 200 via limit/offset query params.

API:
- GET /transactions accepts limit, offset params
- Response includes total_count for frontend pagination

Tests:
- test_transaction_list_pagination covers limit/offset edge cases
```

**Full-stack feature:**
```
feat: add ATM withdrawal with fee support

Track bank fees separately so balance stays accurate.

API:
- fee_amount and fee_category_id fields on Transaction
- compute_current_balance subtracts fees alongside transfers
- sub_type includes atm_withdrawal

Frontend:
- Fee input shown when sub_type is atm_withdrawal
- "Total deducted: ₱X" summary updates live
```

**Infrastructure:**
```
infra: add K8s base manifests for all services

Kustomize base for api, worker, frontend, postgres, redis.

K8s:
- api and worker as Deployments (same image, different command)
- postgres as StatefulSet with 10Gi PVC
- Kustomize overlays for dev and prod
```

**Chore:**
```
chore: add ruff to api dev dependencies

Required for format-code.sh PostToolUse hook.
```

## Quality Checklist

Before committing, verify:
- [ ] Secrets scan passed (no real credentials in diff)
- [ ] Title is under 50 characters
- [ ] Title uses imperative mood (Add, Fix, Update, Remove)
- [ ] Context sentence explains the "why"
- [ ] Changes grouped by category (if multiple types)
- [ ] NO AI attribution anywhere

## Important Notes

- NEVER commit if there are no changes
- Stage all changes with `git add .`
- NO AI attribution (no "Generated with Claude" or "Co-Authored-By")
- `.env` is protected by hooks and should never appear in a commit
