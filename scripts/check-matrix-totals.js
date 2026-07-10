require('dotenv').config({ path: '.env.local' })
require('dotenv').config({ path: '.env' })
const { Pool } = require('pg')
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

async function main() {
  const tx = (await pool.query('SELECT * FROM "TxValidation" ORDER BY "updatedAt" DESC')).rows
  const agg = (await pool.query('SELECT * FROM "AggValidation" ORDER BY "updatedAt" DESC')).rows

  // dynamic import
  const vi = await import('../src/lib/validation-issues.js')

  const matrix = vi.buildAssessorAccountabilityMatrix(tx, agg, [], {})
  console.log('Matrix:', matrix)

  const allIssues = vi.collectAllValidationIssues(tx, agg, {})
  console.log('\nAll validation issues:', allIssues.length)
  const byAssessor = {}
  for (const i of allIssues) {
    const a = vi.getValidationAssessor(i.parentRecord) || 'Unassigned'
    byAssessor[a] = (byAssessor[a] || 0) + 1
    console.log(a, '|', i.source, '|', i.label || i.indicator, '|', i.parentRecord?.facilityName)
  }
  console.log('\nExpected issue totals by assessor:', byAssessor)
}

main().finally(() => pool.end())
