require('dotenv').config({ path: '.env.local' })
require('dotenv').config({ path: '.env' })

const { Pool } = require('pg')

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

async function q(label, sql, params = []) {
  console.log(`\n=== ${label} ===`)
  try {
    const res = await pool.query(sql, params)
    if (!res.rows.length) {
      console.log('(no rows)')
      return res.rows
    }
    console.table(res.rows)
    return res.rows
  } catch (err) {
    console.error('ERROR:', err.message)
    return []
  }
}

async function main() {
  console.log('Database:', process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':****@'))

  await q('Delta user account', `
    SELECT id, name, email, role, state, "createdAt"
    FROM "User"
    WHERE email = 'delta@ecews.org' OR LOWER(state) = 'delta'
    ORDER BY id
  `)

  await q('All users (summary)', `
    SELECT id, name, email, role, state
    FROM "User"
    ORDER BY id
  `)

  await q('Preloads (metadata)', `
    SELECT id, type, period, state, locked, "uploadedBy", "createdAt", "updatedAt"
    FROM "Preload"
    ORDER BY "createdAt" DESC
  `)

  await q('Locked preloads count', `
    SELECT type, locked, COUNT(*)::int AS count
    FROM "Preload"
    GROUP BY type, locked
    ORDER BY type, locked
  `)

  await q('States in latest TX preload JSON', `
    SELECT p.id, p.locked,
           COUNT(*)::int AS total_rows,
           COUNT(DISTINCT elem->>'state')::int AS distinct_states
    FROM "Preload" p,
         LATERAL jsonb_array_elements(p.data::jsonb) AS elem
    WHERE p.type = 'tx'
    GROUP BY p.id, p.locked
    ORDER BY p.id DESC
    LIMIT 5
  `)

  await q('State values in TX preloads (top 20)', `
    SELECT p.id AS preload_id, p.locked, elem->>'state' AS state, COUNT(*)::int AS row_count
    FROM "Preload" p,
         LATERAL jsonb_array_elements(p.data::jsonb) AS elem
    WHERE p.type = 'tx'
    GROUP BY p.id, p.locked, elem->>'state'
    ORDER BY p.id DESC, row_count DESC
    LIMIT 20
  `)

  await q('Delta rows in TX preloads (any spelling)', `
    SELECT p.id AS preload_id, p.locked, elem->>'state' AS state, COUNT(*)::int AS row_count
    FROM "Preload" p,
         LATERAL jsonb_array_elements(p.data::jsonb) AS elem
    WHERE p.type = 'tx'
      AND LOWER(TRIM(COALESCE(elem->>'state', ''))) LIKE '%delta%'
    GROUP BY p.id, p.locked, elem->>'state'
    ORDER BY p.id DESC
  `)

  await q('States in AGG preloads', `
    SELECT p.id AS preload_id, p.locked, elem->>'state' AS state, COUNT(*)::int AS row_count
    FROM "Preload" p,
         LATERAL jsonb_array_elements(p.data::jsonb) AS elem
    WHERE p.type = 'agg'
    GROUP BY p.id, p.locked, elem->>'state'
    ORDER BY p.id DESC, row_count DESC
  `)

  await q('Delta rows in AGG preloads', `
    SELECT p.id AS preload_id, p.locked, elem->>'state' AS state, COUNT(*)::int AS row_count
    FROM "Preload" p,
         LATERAL jsonb_array_elements(p.data::jsonb) AS elem
    WHERE p.type = 'agg'
      AND LOWER(TRIM(COALESCE(elem->>'state', ''))) LIKE '%delta%'
    GROUP BY p.id, p.locked, elem->>'state'
    ORDER BY p.id DESC
  `)

  await q('TX validations by state', `
    SELECT state, COUNT(*)::int AS count
    FROM "TxValidation"
    GROUP BY state
    ORDER BY count DESC
  `)

  await q('Delta TX validations', `
    SELECT COUNT(*)::int AS count
    FROM "TxValidation"
    WHERE LOWER(TRIM(state)) LIKE '%delta%'
  `)

  await q('AGG validations by state', `
    SELECT state, COUNT(*)::int AS count
    FROM "AggValidation"
    GROUP BY state
    ORDER BY count DESC
  `)

  await q('Issues by state', `
    SELECT state, COUNT(*)::int AS count
    FROM "Issue"
    GROUP BY state
    ORDER BY count DESC
  `)

  await q('Sample TX preload row keys (latest TX)', `
    SELECT jsonb_object_keys(elem) AS key
    FROM "Preload" p,
         LATERAL jsonb_array_elements(p.data::jsonb) AS elem
    WHERE p.type = 'tx'
    ORDER BY p.id DESC
    LIMIT 1
  `)
}

main()
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => pool.end())
