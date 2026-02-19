#!/bin/bash
# PreToolUse hook - Security protection
# Blocks writes to sensitive files and dangerous commands

INPUT=$(cat)

TOOL=$(echo "$INPUT" | jq -r '.tool_name // empty')
FILE_PATH=$(echo "$INPUT" | jq -r '.parameters.file_path // empty')
COMMAND=$(echo "$INPUT" | jq -r '.parameters.command // empty')

# =============================================================================
# FILE PROTECTION (Write/Edit operations)
# =============================================================================

if [[ "$TOOL" == "Write" || "$TOOL" == "Edit" ]]; then

  # --- Sensitive file patterns ---
  PROTECTED_PATTERNS=(
    ".env"
    ".env.local"
    ".env.production"
    ".env.staging"
    "credentials.json"
    "secrets.json"
    "secrets.yaml"
    "secrets.yml"
    "secret.yaml"
    "secret.yml"
    ".pem"
    ".key"
    ".crt"
    "id_rsa"
    "id_ed25519"
    "serviceAccountKey"
    "google-credentials"
    "uv.lock"
    "pnpm-lock.yaml"
  )

  for pattern in "${PROTECTED_PATTERNS[@]}"; do
    if [[ "$FILE_PATH" == *"$pattern"* ]]; then
      echo "❌ BLOCKED: Cannot modify sensitive file: $FILE_PATH"
      echo "   Pattern matched: '$pattern'"
      echo "   Credentials and lock files must be modified manually"
      exit 1
    fi
  done

  # --- Production deployment files ---
  if [[ "$FILE_PATH" == *"docker-compose.prod"* ]] || \
     [[ "$FILE_PATH" == *"Dockerfile.prod"* ]]; then
    echo "❌ BLOCKED: Cannot modify production deployment files"
    echo "   File: $FILE_PATH"
    echo "   Production configs require manual review"
    exit 1
  fi

  # --- Warn on Alembic migrations (allow but warn) ---
  if [[ "$FILE_PATH" == *"migrations/versions"* ]]; then
    echo "⚠️  WARNING: Modifying an Alembic migration file"
    echo "   Existing migrations should not be edited after being applied"
    echo "   Create a new migration instead: uv run alembic revision --autogenerate"
    echo "   Proceeding..."
  fi

fi

# =============================================================================
# COMMAND PROTECTION (Bash operations)
# =============================================================================

if [[ "$TOOL" == "Bash" && -n "$COMMAND" ]]; then

  # --- Destructive system commands ---
  DANGEROUS_PATTERNS=(
    "rm -rf /"
    "rm -rf /*"
    "rm -rf ~"
    "> /dev/sd"
    "mkfs."
    ":(){:|:&};:"
    "dd if=/dev"
    "chmod -R 777"
    "chown -R"
  )

  for pattern in "${DANGEROUS_PATTERNS[@]}"; do
    if [[ "$COMMAND" == *"$pattern"* ]]; then
      echo "❌ BLOCKED: Dangerous command detected"
      echo "   Command: $COMMAND"
      echo "   Pattern: '$pattern'"
      exit 1
    fi
  done

  # --- Git force push to main/master ---
  if [[ "$COMMAND" == *"git push"*"--force"* ]] || \
     [[ "$COMMAND" == *"git push"*"-f"* ]]; then
    if [[ "$COMMAND" == *"main"* ]] || [[ "$COMMAND" == *"master"* ]]; then
      echo "❌ BLOCKED: Force push to main/master is not allowed"
      echo "   Command: $COMMAND"
      echo "   Use regular push or create a PR"
      exit 1
    fi
  fi

  # --- Database drop protection ---
  if [[ "$COMMAND" == *"DROP DATABASE"* ]] || \
     [[ "$COMMAND" == *"dropdb"* ]]; then
    echo "❌ BLOCKED: Database drop operation"
    echo "   Command: $COMMAND"
    echo "   Use Alembic migrations for schema changes"
    exit 1
  fi

  # --- Alembic downgrade warning ---
  if [[ "$COMMAND" == *"alembic downgrade"* ]]; then
    echo "⚠️  WARNING: Alembic downgrade will revert migrations"
    echo "   Command: $COMMAND"
    echo "   This may cause data loss. Proceeding..."
  fi

fi

# Allow operation
exit 0
