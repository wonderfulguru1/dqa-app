require('dotenv').config({ path: '.env.local' })
require('dotenv').config({ path: '.env' })

const { PrismaClient } = require('@prisma/client')
const { PrismaPg } = require('@prisma/adapter-pg')
const { Pool } = require('pg')
const {
  latestPreload,
  filterRowsByState,
  getProcessedPreload,
  preloadMetaSelect,
  TX_PRELOAD_INLINE_MAX,
  buildTxIndex,
} = require('../src/lib/preload-process')

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

async function simulateBootstrap(role, state) {
  const isHq = role === 'hq'
  const session = { role, state }

  const [txPreList, aggPreList] = await Promise.all([
    prisma.preload.findMany({ where: { type: 'tx' }, orderBy: { createdAt: 'desc' }, select: preloadMetaSelect }),
    prisma.preload.findMany({ where: { type: 'agg' }, orderBy: { createdAt: 'desc' }, select: preloadMetaSelect }),
  ])

  const currentTxPreload = latestPreload(txPreList, { hq: isHq })
  const currentAggPreload = latestPreload(aggPreList, { hq: isHq })

  console.log(`\n--- ${role}${state ? ` (${state})` : ''} ---`)
  console.log('TX preloads:', txPreList.map(p => `#${p.id} locked=${p.locked}`))
  console.log('AGG preloads:', aggPreList.map(p => `#${p.id} locked=${p.locked}`))
  console.log('Active TX:', currentTxPreload ? `#${currentTxPreload.id} locked=${currentTxPreload.locked}` : 'NONE')
  console.log('Active AGG:', currentAggPreload ? `#${currentAggPreload.id} locked=${currentAggPreload.locked}` : 'NONE')

  if (currentTxPreload) {
    const full = await prisma.preload.findUnique({ where: { id: currentTxPreload.id }, select: { data: true, updatedAt: true } })
    let rows = getProcessedPreload(currentTxPreload.id, full.updatedAt, 'tx', full.data).preloadTx
    if (session.role === 'field' && session.state) rows = filterRowsByState(rows, session.state)
    console.log(`TX rows after state filter: ${rows.length}`)
    console.log(`preloadTxLarge: ${rows.length > TX_PRELOAD_INLINE_MAX}`)
    if (rows.length > TX_PRELOAD_INLINE_MAX) {
      const idx = buildTxIndex(rows)
      console.log(`txIndex states: ${idx.states.join(', ')}`)
    }
  } else {
    console.log('TX rows after state filter: 0 (no active TX preload)')
  }

  if (currentAggPreload) {
    const full = await prisma.preload.findUnique({ where: { id: currentAggPreload.id }, select: { data: true, updatedAt: true } })
    let rows = getProcessedPreload(currentAggPreload.id, full.updatedAt, 'agg', full.data).preloadAgg
    if (session.role === 'field' && session.state) rows = filterRowsByState(rows, session.state)
    console.log(`AGG rows after state filter: ${rows.length}`)
  } else {
    console.log('AGG rows after state filter: 0 (no active AGG preload)')
  }
}

async function main() {
  await simulateBootstrap('hq')
  await simulateBootstrap('field', 'Osun')
  await simulateBootstrap('field', 'Delta')
}

main().finally(() => prisma.$disconnect())
