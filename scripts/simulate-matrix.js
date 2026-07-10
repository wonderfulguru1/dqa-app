require('dotenv').config({ path: '.env.local' })
require('dotenv').config({ path: '.env' })
const { Pool } = require('pg')

// Minimal ESM interop - duplicate logic inline
const { PrismaClient } = require('@prisma/client')
const { PrismaPg } = require('@prisma/adapter-pg')

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

  const tx = await prisma.txValidation.findMany({ orderBy: { updatedAt: 'desc' } })
  const agg = await prisma.aggValidation.findMany({ orderBy: { updatedAt: 'desc' } })

  // dynamic import for ESM module
  const vi = await import('../src/lib/validation-issues.js')
  const issues = vi.collectAllValidationIssues(tx, agg).map(vi.validationIssueToHqRow)

  const byPerson = {}
  for (const i of issues) {
    const p = i.assessor || 'Unassigned'
    byPerson[p] = (byPerson[p] || 0) + 1
  }
  console.log('Matrix assessors:', byPerson)
  console.log('Sample rows:')
  issues.slice(0, 5).forEach(i => console.log({ assessor: i.assessor, facility: i.facility, gap: i.gap?.slice(0, 40) }))

  await prisma.$disconnect()
  await pool.end()
}

main().catch(e => { console.error(e); process.exit(1) })
