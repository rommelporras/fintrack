# CLAUDE.md

## Rules

- **No dev server management** — never run `uvicorn` or `pnpm dev` yourself. Use `docker compose` for local development.
- **Python 3.14+** — do not use syntax or APIs unavailable in 3.14.
- **WSL2**: use `127.0.0.1` instead of `localhost` in `DATABASE_URL` when running alembic commands — asyncpg has intermittent DNS failures with `localhost`.

## MCP Servers

- **next-devtools** (`.mcp.json`) — connects to the Next.js Turbopack dev server. Use `get_errors` to diagnose build/runtime errors with full stack traces instead of just running `tsc --noEmit`. Also provides `get_routes` and `get_logs`. Requires the frontend dev server to be running (`bun run dev` or via Docker).

## Hooks

Hooks auto-run on every session. No manual invocation needed.

- **SessionStart** (`.claude/hooks/setup-dev-env.sh`) — checks Docker, git status on session start
- **PreToolUse** (`.claude/hooks/protect-sensitive.sh`) — blocks writes to `.env`, credentials, lock files, and production configs. Blocks destructive bash commands (rm -rf, force push to main, DROP DATABASE). Warns on Alembic migration edits.
- **PostToolUse** (`.claude/hooks/format-code.sh`) — auto-formats after every Write/Edit: Python files with `ruff`, TypeScript/TSX with `prettier` + `eslint`, JSON with `prettier`.
