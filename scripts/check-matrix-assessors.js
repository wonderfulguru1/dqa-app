require('dotenv').config({ path: '.env.local' })
require('dotenv').config({ path: '.env' })
const { Pool } = require('pg')
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

function completeResolutions(raw) {
  if (!raw || typeof raw !== 'object') return []
  return Object.entries(raw).filter(([, v]) => String(v?.gap || '').trim())
}

async function main() {
  const tx = await pool.query(`SELECT assessor, "facilityName", "mismatchResolutions" FROM "TxValidation"`)
  console.log('TX issues by assessor:')
  const txMap = {}
  for (const row of tx.rows) {
    const n = completeResolutions(row.mismatchResolutions).length
    if (!n) continue
    txMap[row.assessor] = (txMap[row.assessor] || 0) + n
    console.log(' ', row.assessor, '|', row.facilityName, '|', n, 'issue(s)')
  }
  console.log('TX totals:', txMap)

  const agg = await pool.query(`SELECT assessor, "facilityName", "mismatchResolution" FROM "AggValidation"`)
  console.log('\nAGG issues by assessor:')
  const aggMap = {}
  for (const row of agg.rows) {
    const res = row.mismatchResolution
    const n = res && String(res.gap || '').trim() ? 1 : 0
    if (!n) continue
    aggMap[row.assessor] = (aggMap[row.assessor] || 0) + n
    console.log(' ', row.assessor, '|', row.facilityName, '|', n, 'issue(s)')
  }
  console.log('AGG totals:', aggMap)
}

main().finally(() => pool.end())
