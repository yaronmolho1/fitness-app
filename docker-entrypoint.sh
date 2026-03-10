#!/bin/sh
# Don't use set -e — app starts even if migrations fail

echo "Starting fitness-app..."

if [ -z "$DATABASE_URL" ]; then
  echo "Warning: DATABASE_URL not set, using default /app/data/db.sqlite"
  export DATABASE_URL=/app/data/db.sqlite
fi

echo "Running database migrations..."
if ./node_modules/.bin/drizzle-kit migrate 2>/dev/null; then
  echo "Migrations complete"
else
  EXIT_CODE=$?
  echo "Migration warning (exit $EXIT_CODE) — app will start anyway"
  echo "Run manually: docker compose exec app ./node_modules/.bin/drizzle-kit migrate"
fi

echo "Starting application..."
exec node server.js
