# CLAUDE.md

## Rules

- **No AI attribution** — no "Co-Authored-By: Claude", "Generated with Claude Code", or any AI-related lines in commits or code comments.
- **No automatic commits or pushes** — only commit when explicitly asked or via `/commit`. Never push unless asked.
- **No dev server management** — never run `uvicorn` or `pnpm dev` yourself. Use `docker compose` for local development.
- **Frontend**: use `bun`, never `npm`, `yarn`, or `pnpm`.
- **Backend**: use `uv`, never `pip` directly.
- **Python 3.14+** — do not use syntax or APIs unavailable in 3.14.
- **TypeScript strict mode** — no `any`, no `// @ts-ignore`.
- **WSL2**: use `127.0.0.1` instead of `localhost` in `DATABASE_URL` when running alembic commands — asyncpg has intermittent DNS failures with `localhost`.
