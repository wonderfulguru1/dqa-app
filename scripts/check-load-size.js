require('dotenv').config({ path: '.env.local' })
require('dotenv').config({ path: '.env' })
const { Pool } = require('pg')
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

async function main() {
  const preloads = await pool.query(`
    SELECT id, type, locked,
           pg_column_size(data) AS bytes,
           jsonb_array_length(data::jsonb) AS rows
    FROM "Preload"
    ORDER BY id DESC
  `)
  console.log('Preload sizes:')
  console.table(preloads.rows.map(r => ({
    id: r.id,
    type: r.type,
    locked: r.locked,
    rows: Number(r.rows),
    mb: (Number(r.bytes) / 1024 / 1024).toFixed(2),
  })))

  const counts = await pool.query(`
    SELECT
      (SELECT COUNT(*)::int FROM "TxValidation") AS tx_validations,
      (SELECT COUNT(*)::int FROM "AggValidation") AS agg_validations,
      (SELECT COUNT(*)::int FROM "Issue") AS issues
  `)
  console.log('Saved records:', counts.rows[0])
}

main().finally(() => pool.end())
