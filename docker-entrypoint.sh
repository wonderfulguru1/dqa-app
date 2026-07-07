#!/bin/sh
set -e

PORT="${PORT:-5004}"

echo "Waiting for PostgreSQL..."
until node -e "
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  pool.query('SELECT 1')
    .then(() => { pool.end(); process.exit(0); })
    .catch(() => { pool.end(); process.exit(1); });
"; do
  sleep 2
done

echo "Applying database schema..."
npx prisma db push

echo "Seeding default HQ user (if needed)..."
node prisma/seed.js || true

echo "Starting ECEWS DQA Companion on port ${PORT}..."
exec npx next start -p "${PORT}"
