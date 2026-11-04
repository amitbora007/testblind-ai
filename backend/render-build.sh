#!/usr/bin/env bash
# Exit immediately if a command exits with a non-zero status
set -o errexit

echo "==> Upgrading pip..."
python -m pip install --upgrade pip

echo "==> Installing backend dependencies..."
pip install -r requirements.txt

echo "==> Applying database migrations via Alembic..."
alembic upgrade head

echo "==> Backend build and migration completed successfully!"
