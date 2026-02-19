#!/bin/bash
# PostToolUse hook - Auto-format files after Write/Edit
# Handles: Python (ruff), TypeScript/TSX (prettier + eslint), JSON (prettier)

INPUT=$(cat)

TOOL=$(echo "$INPUT" | jq -r '.tool_name // empty')
FILE_PATH=$(echo "$INPUT" | jq -r '.parameters.file_path // empty')

# Only run after Write/Edit
if [[ "$TOOL" != "Write" && "$TOOL" != "Edit" ]]; then
  exit 0
fi

# Resolve to absolute path
if [[ ! "$FILE_PATH" = /* ]]; then
  FILE_PATH="$(pwd)/$FILE_PATH"
fi

# Skip if file doesn't exist
if [[ ! -f "$FILE_PATH" ]]; then
  exit 0
fi

PROJECT_DIR="/home/wsl/personal/fintrack"
API_DIR="$PROJECT_DIR/api"
FRONTEND_DIR="$PROJECT_DIR/frontend"

# =============================================================================
# Python files — ruff format + ruff check --fix
# =============================================================================

if [[ "$FILE_PATH" == *.py ]]; then
  if command -v uv &>/dev/null && [[ -d "$API_DIR/.venv" ]]; then
    echo "🐍 Formatting: $(basename "$FILE_PATH")"

    cd "$API_DIR"

    if uv run ruff format "$FILE_PATH" --quiet 2>/dev/null; then
      echo "   ✅ ruff format"
    else
      echo "   ⚠️  ruff format failed (non-blocking)"
    fi

    if uv run ruff check --fix "$FILE_PATH" --quiet 2>/dev/null; then
      : # success, no output
    fi
  fi
fi

# =============================================================================
# TypeScript / TSX files — prettier + eslint
# =============================================================================

if [[ "$FILE_PATH" == *.ts || "$FILE_PATH" == *.tsx ]]; then
  if [[ -d "$FRONTEND_DIR/node_modules" ]]; then
    echo "🎨 Formatting: $(basename "$FILE_PATH")"

    cd "$FRONTEND_DIR"

    if bunx prettier --write "$FILE_PATH" --loglevel=silent 2>/dev/null; then
      echo "   ✅ prettier"
    else
      echo "   ⚠️  prettier failed (non-blocking)"
    fi

    if bunx eslint --fix "$FILE_PATH" --quiet 2>/dev/null; then
      : # success
    fi
  fi
fi

# =============================================================================
# JSON files — prettier (skip node_modules, lock files, .next, generated)
# =============================================================================

if [[ "$FILE_PATH" == *.json ]]; then
  if [[ "$FILE_PATH" != *"node_modules"* && \
        "$FILE_PATH" != *".lock"* && \
        "$FILE_PATH" != *".next"* && \
        "$FILE_PATH" != *"__pycache__"* ]]; then
    if [[ -d "$FRONTEND_DIR/node_modules" ]]; then
      cd "$FRONTEND_DIR"
      if bunx prettier --write "$FILE_PATH" --loglevel=silent 2>/dev/null; then
        echo "✅ JSON formatted: $(basename "$FILE_PATH")"
      fi
    fi
  fi
fi

exit 0
