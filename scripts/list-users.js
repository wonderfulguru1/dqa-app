require('dotenv').config({ path: '.env.local' })
require('dotenv').config({ path: '.env' })

const { Pool } = require('pg')
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

pool.query('SELECT id, name, email, role, state FROM "User" ORDER BY id')
  .then(r => {
    console.table(r.rows)
    return pool.end()
  })
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
