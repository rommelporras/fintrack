# CLAUDE.md

## Rules

- **No dev server management** — never run `uvicorn` or `bun dev` yourself. Use `docker compose` for local development.
- **Python 3.14+** — do not use syntax or APIs unavailable in 3.14.
- **WSL2**: use `127.0.0.1` instead of `localhost` in `DATABASE_URL` when running alembic commands — asyncpg has intermittent DNS failures with `localhost`.
- **Docker service names** — containers must reference each other by service name (`postgres`, `redis`), not `localhost`.

## Common commands

```bash
# Run API tests
docker compose run --rm api pytest

# Apply a new migration
DATABASE_URL="postgresql+asyncpg://finance:changeme@127.0.0.1:5435/finance_db" \
  docker compose run --rm api alembic upgrade head

# Rebuild frontend (use -V to renew anonymous node_modules/.next volumes)
docker compose up -d --build -V frontend

# Tail logs
docker compose logs -f api
docker compose logs -f frontend
```

## MCP Servers

- **next-devtools** (`.mcp.json`) — connects to the Next.js Turbopack dev server. Use `get_errors` to diagnose build/runtime errors with full stack traces instead of just running `tsc --noEmit`. Also provides `get_routes` and `get_logs`. Requires the frontend dev server to be running (`bun run dev` or via Docker).

## Hooks

Hooks auto-run on every session. No manual invocation needed.

- **SessionStart** (`.claude/hooks/setup-dev-env.sh`) — checks Docker, git status on session start
- **PreToolUse** (`.claude/hooks/protect-sensitive.sh`) — blocks writes to `.env`, credentials, lock files, and production configs. Blocks destructive bash commands (rm -rf, force push to main, DROP DATABASE). Warns on Alembic migration edits.
- **PostToolUse** (`.claude/hooks/format-code.sh`) — auto-formats after every Write/Edit: Python files with `ruff`, TypeScript/TSX with `prettier` + `eslint`, JSON with `prettier`.
