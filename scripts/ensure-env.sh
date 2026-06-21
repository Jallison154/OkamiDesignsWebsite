#!/bin/sh
# Ensure .env exists so deploy scripts and optional tooling do not fail.
# The Node server loads .env from the project root via server/config/load-env.js
# (works with the docker volume mount ./:/app — no docker-compose env_file required).

set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env"
EXAMPLE_FILE="$ROOT/.env.example"

if [ -f "$ENV_FILE" ]; then
    exit 0
fi

if [ -f "$EXAMPLE_FILE" ]; then
    cp "$EXAMPLE_FILE" "$ENV_FILE"
    echo "Created .env from .env.example"
    echo "Edit .env and set ADMIN_PASSWORD_HASH + ADMIN_SESSION_SECRET (see docs/ADMIN-LOGIN-SETUP.md)"
else
    touch "$ENV_FILE"
    echo "Created empty .env — add server secrets (see docs/ADMIN-LOGIN-SETUP.md)"
fi
