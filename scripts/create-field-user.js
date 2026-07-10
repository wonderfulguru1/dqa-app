require('dotenv').config({ path: '.env.local' })
require('dotenv').config({ path: '.env' })

const bcrypt = require('bcryptjs')
const { Pool } = require('pg')

const [name, email, password, state] = process.argv.slice(2)

if (!name || !email || !password || !state) {
  console.error('Usage: node scripts/create-field-user.js <name> <email> <password> <state>')
  process.exit(1)
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

async function main() {
  const hashed = await bcrypt.hash(password, 12)
  const result = await pool.query(
    `INSERT INTO "User" (name, email, password, role, state)
     VALUES ($1, $2, $3, 'field', $4)
     ON CONFLICT (email) DO UPDATE SET
       name = EXCLUDED.name,
       password = EXCLUDED.password,
       role = EXCLUDED.role,
       state = EXCLUDED.state
     RETURNING id, name, email, role, state`,
    [name, email, hashed, state]
  )
  console.log('User ready:')
  console.table(result.rows)
}

main()
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => pool.end())
