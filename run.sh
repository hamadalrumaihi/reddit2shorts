#!/usr/bin/env bash
# One-click runner for reddit2shorts (macOS/Linux).
# Usage: ./run.sh            (or pass extra args: ./run.sh --preset aita-judgment)
set -e
cd "$(dirname "$0")"

echo "[1/4] Updating from GitHub..."
git pull --ff-only

echo "[2/4] Installing dependencies..."
bun install

echo "[3/4] Checking environment..."
bun src/cli.ts --doctor

echo "[4/4] Rendering a short..."
bun src/cli.ts --random "$@"

echo "Done. Your video is in the shorts/ folder."
