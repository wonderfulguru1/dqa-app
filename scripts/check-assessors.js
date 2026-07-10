require('dotenv').config({ path: '.env.local' })
require('dotenv').config({ path: '.env' })
const { Pool } = require('pg')
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

async function main() {
  const tx = await pool.query(`
    SELECT id, assessor, "facilityName", period, "mismatchResolutions" IS NOT NULL AS has_res
    FROM "TxValidation"
    ORDER BY "updatedAt" DESC
    LIMIT 15
  `)
  console.log('TX validations:')
  console.table(tx.rows)

  const agg = await pool.query(`
    SELECT id, assessor, "facilityName", period
    FROM "AggValidation"
    ORDER BY "updatedAt" DESC
    LIMIT 10
  `)
  console.log('AGG validations:')
  console.table(agg.rows)
}

main().finally(() => pool.end())
