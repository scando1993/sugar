#!/bin/bash
# Bootstraps the sugar CLI: installs dependencies, builds, and links the
# `sugar` binary onto PATH. Run from the plugin/repo root.
#
# Usage: ./scripts/install.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

if ! command -v node >/dev/null 2>&1; then
  echo "error: node is required but was not found on PATH." >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "error: npm is required but was not found on PATH." >&2
  exit 1
fi

echo "==> Installing dependencies"
npm install

echo "==> Building"
npm run build

echo "==> Linking sugar CLI onto PATH"
npm link

echo "==> Verifying"
if ! command -v sugar >/dev/null 2>&1; then
  echo "error: 'sugar' was not found on PATH after npm link." >&2
  echo "       Check your npm global bin directory is on PATH (npm config get prefix)." >&2
  exit 1
fi

LINKED_BIN="$(command -v sugar)"
LINKED_TARGET="$(cd "$(dirname "$(readlink "$LINKED_BIN" 2>/dev/null || echo "$LINKED_BIN")")" 2>/dev/null && pwd || true)"
if [ -n "$LINKED_TARGET" ] && [[ "$LINKED_TARGET" != "$REPO_ROOT"* ]]; then
  echo "warning: 'sugar' on PATH resolves outside this repo ($LINKED_BIN)." >&2
  echo "         Another package or checkout may be linked as 'sugar'. Re-run 'npm link' from" >&2
  echo "         $REPO_ROOT if commands behave unexpectedly." >&2
fi

echo ""
echo "sugar CLI installed: $(command -v sugar)"
echo "Run 'sugar' with no arguments to see usage."