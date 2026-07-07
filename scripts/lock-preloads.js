require('dotenv').config({ path: '.env.local' })
require('dotenv').config({ path: '.env' })
const { Pool } = require('pg')
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

pool.query('UPDATE "Preload" SET locked = true WHERE id IN (10, 11) RETURNING id, type, locked')
  .then(r => {
    console.log('Locked preloads:')
    console.table(r.rows)
  })
  .catch(console.error)
  .finally(() => pool.end())
