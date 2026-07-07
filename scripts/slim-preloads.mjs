/**
 * One-time script: slim existing preload JSON in the database.
 * Run: node scripts/slim-preloads.mjs
 */
import pg from 'pg'
import { processAggPreloadData, processTxPreloadData } from '../src/lib/preload-process.js'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

async function main() {
  const { rows } = await pool.query('SELECT id, type, data FROM "Preload" ORDER BY id')
  let updated = 0

  for (const row of rows) {
    const data = row.data
    if (!Array.isArray(data) || !data.length) continue

    const first = data[0]
    const alreadySlim = first && 'dqaPeriod' in first && !('DQA Period' in first) && !('raw' in first)
    if (alreadySlim) continue

    const processed = row.type === 'tx'
      ? processTxPreloadData(data)
      : processAggPreloadData(data)

    await pool.query('UPDATE "Preload" SET data = $1::jsonb, "updatedAt" = NOW() WHERE id = $2', [
      JSON.stringify(processed),
      row.id,
    ])
    updated++
    const kb = (JSON.stringify(processed).length / 1024).toFixed(0)
    console.log(`Preload #${row.id} (${row.type}): ${data.length} rows → ${kb} KB`)
  }

  console.log(updated ? `Updated ${updated} preload(s).` : 'All preloads already slim.')
  await pool.end()
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
