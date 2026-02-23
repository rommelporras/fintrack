#!/bin/bash
# SessionStart hook - Development environment check
# Runs at the start of each Claude Code session

set -e

echo ""
echo "════════════════════════════════════════════════════════"
echo "  FINTRACK DEV ENVIRONMENT"
echo "════════════════════════════════════════════════════════"
echo ""

ISSUES=0
PROJECT_DIR="/home/wsl/personal/fintrack"

# =============================================================================
# 1. Runtime Requirements
# =============================================================================

echo "📦 Runtime:"

if command -v uv &>/dev/null; then
  UV_VERSION=$(uv --version 2>/dev/null | head -1 || echo "unknown")
  echo "   ✅ $UV_VERSION"
else
  echo "   ❌ uv not found — install: curl -LsSf https://astral.sh/uv/install.sh | sh"
  ((ISSUES++))
fi

if command -v bun &>/dev/null; then
  BUN_VERSION=$(bun --version 2>/dev/null || echo "unknown")
  echo "   ✅ bun $BUN_VERSION"
else
  echo "   ❌ bun not found — install: curl -fsSL https://bun.sh/install | bash"
  ((ISSUES++))
fi

if command -v docker &>/dev/null; then
  echo "   ✅ Docker available"
else
  echo "   ⚠️  Docker not found (needed for postgres, redis)"
fi

echo ""

# =============================================================================
# 2. Docker Services
# =============================================================================

echo "🐳 Services:"

if docker ps 2>/dev/null | grep -qE "fintrack.*postgres|fintrack_postgres|fintrack-postgres"; then
  echo "   ✅ PostgreSQL running"
else
  echo "   ⚠️  PostgreSQL not running — start: docker compose up postgres -d"
fi

if docker ps 2>/dev/null | grep -qE "fintrack.*redis|fintrack_redis|fintrack-redis"; then
  echo "   ✅ Redis running"
else
  echo "   ⚠️  Redis not running — start: docker compose up redis -d"
fi

echo ""

# =============================================================================
# 3. API Health
# =============================================================================

echo "🔌 API (FastAPI :8000):"

if curl -s --connect-timeout 2 http://localhost:8000/health > /dev/null 2>&1; then
  echo "   ✅ API running"
else
  echo "   ⚠️  API not running — start: cd api && uv run uvicorn app.main:app --reload"
fi

echo ""

# =============================================================================
# 4. Frontend Health
# =============================================================================

echo "🌐 Frontend (Next.js :3000):"

if curl -s --connect-timeout 2 http://localhost:3000 > /dev/null 2>&1; then
  echo "   ✅ Frontend running"
else
  echo "   ⚠️  Frontend not running — start: cd frontend && bun dev"
fi

echo ""

# =============================================================================
# 5. Project Structure
# =============================================================================

echo "📁 Project:"

if [[ -f "$PROJECT_DIR/.env" ]]; then
  echo "   ✅ .env file exists"
else
  echo "   ⚠️  Missing .env — run: cp .env.example .env"
fi

if [[ -d "$PROJECT_DIR/api/.venv" ]]; then
  echo "   ✅ Python venv exists (api/.venv)"
else
  echo "   ⚠️  Python venv missing — run: cd api && uv sync"
fi

if [[ -d "$PROJECT_DIR/frontend/node_modules" ]]; then
  echo "   ✅ Node modules installed (frontend/node_modules)"
else
  echo "   ⚠️  Node modules missing — run: cd frontend && bun install"
fi

echo ""

# =============================================================================
# 6. Git Status
# =============================================================================

echo "📝 Git:"

cd "$PROJECT_DIR" 2>/dev/null || true

BRANCH=$(git branch --show-current 2>/dev/null || echo "not a git repo")
echo "   Branch: $BRANCH"

CHANGES=$(git status --porcelain 2>/dev/null | wc -l)
if [[ $CHANGES -gt 0 ]]; then
  echo "   ⚠️  $CHANGES uncommitted change(s)"
else
  echo "   ✅ Working tree clean"
fi

echo ""

# =============================================================================
# 7. Available MCP Servers
# =============================================================================

echo "📡 MCP Servers:"
echo "   • playwright  — Browser automation & E2E testing"
echo "   • context7    — Library documentation lookup"
echo ""

# =============================================================================
# Summary
# =============================================================================

echo "════════════════════════════════════════════════════════"
if [[ $ISSUES -eq 0 ]]; then
  echo "  ✅ Environment ready"
else
  echo "  ❌ $ISSUES critical issue(s) found — see above"
fi
echo "════════════════════════════════════════════════════════"
echo ""

# Always succeed — don't block session start
exit 0
