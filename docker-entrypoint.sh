#!/bin/sh
# Don't use set -e — app starts even if migrations fail

echo "Starting fitness-app..."

if [ -z "$DATABASE_URL" ]; then
  echo "Warning: DATABASE_URL not set, using default /app/data/db.sqlite"
  export DATABASE_URL=/app/data/db.sqlite
fi

echo "Running database migrations..."
if node -e "
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const db = new Database(process.env.DATABASE_URL);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec('CREATE TABLE IF NOT EXISTS __drizzle_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, hash TEXT NOT NULL, created_at INTEGER)');
const journal = JSON.parse(fs.readFileSync('./lib/db/migrations/meta/_journal.json', 'utf8'));
const applied = new Set(db.prepare('SELECT hash FROM __drizzle_migrations').all().map(r => r.hash));
for (const entry of journal.entries) {
  if (applied.has(entry.tag)) continue;
  const sql = fs.readFileSync(path.join('./lib/db/migrations', entry.tag + '.sql'), 'utf8');
  const stmts = sql.split('--> statement-breakpoint').map(s => s.trim()).filter(Boolean);
  const tx = db.transaction(() => { for (const s of stmts) db.exec(s); db.prepare('INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)').run(entry.tag, Date.now()); });
  tx();
  console.log('Applied: ' + entry.tag);
}
db.close();
console.log('Migrations complete');
"; then
  echo "Migrations OK"
else
  EXIT_CODE=$?
  echo "Migration warning (exit $EXIT_CODE) — app will start anyway"
fi

echo "Starting application..."
exec node server.js
