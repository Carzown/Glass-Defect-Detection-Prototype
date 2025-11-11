#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR"

# Start Node backend
PORT=${PORT:-5000}
echo "Starting backend on port $PORT..."
node server.js
