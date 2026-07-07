import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import {
  filterRowsByState,
  getProcessedPreload,
  latestPreload,
  preloadMetaSelect,
} from '@/lib/preload-process'

const TX_CLIENTS_PAGE_SIZE = 500

async function getActiveTxPreload(session) {
  const isHq = session.role === 'hq'
  const txPreList = await prisma.preload.findMany({
    where: { type: 'tx' },
    orderBy: { createdAt: 'desc' },
    select: preloadMetaSelect,
  })
  const current = latestPreload(txPreList, { hq: isHq })
  if (!current) return null

  const full = await prisma.preload.findUnique({
    where: { id: current.id },
    select: { data: true, updatedAt: true },
  })
  if (!full) return null

  const rows = getProcessedPreload(current.id, full.updatedAt, 'tx', full.data).preloadTx
  return { meta: current, rows }
}

export async function GET(request) {
  const session = await getSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const state = searchParams.get('state') || ''
  const facility = searchParams.get('facility') || ''
  const q = (searchParams.get('q') || '').trim().toLowerCase()
  const offset = Math.max(0, Number(searchParams.get('offset') || 0))

  if (!facility) {
    return Response.json({ error: 'facility is required' }, { status: 400 })
  }

  const active = await getActiveTxPreload(session)
  if (!active) return Response.json({ clients: [], total: 0 })

  let rows = active.rows
  if (session.role === 'field' && session.state) {
    rows = filterRowsByState(rows, session.state)
  }
  if (state) {
    rows = rows.filter(r => String(r.state || '').trim() === state.trim())
  }
  rows = rows.filter(r => String(r.facilityName || '').trim() === facility.trim())

  if (q) {
    rows = rows.filter(r => {
      const hay = `${r.pepId || ''} ${r.patientId || ''}`.toLowerCase()
      return hay.includes(q)
    })
  }

  const total = rows.length
  const clients = rows.slice(offset, offset + TX_CLIENTS_PAGE_SIZE)

  return Response.json({ clients, total, hasMore: offset + clients.length < total })
}
