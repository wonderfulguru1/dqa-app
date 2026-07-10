require('dotenv').config({ path: '.env.local' })
require('dotenv').config({ path: '.env' })
const { Pool } = require('pg')
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

async function main() {
  const r = await pool.query(`
    SELECT assessor, "facilityName", "mismatchResolutions"
    FROM "TxValidation"
    WHERE "mismatchResolutions" IS NOT NULL
    ORDER BY "updatedAt" DESC
  `)
  for (const row of r.rows) {
    const res = row.mismatchResolutions || {}
    const keys = Object.keys(res)
    const complete = keys.filter(k => String(res[k]?.gap || '').trim())
    if (complete.length) {
      console.log({ assessor: row.assessor, facility: row.facilityName, issues: complete.length, sampleGap: res[complete[0]]?.gap?.slice(0, 40) })
    }
  }
}

main().finally(() => pool.end())
