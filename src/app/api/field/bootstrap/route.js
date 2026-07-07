import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import {
  aggSavedSelect,
  buildTxIndex,
  filterRowsByState,
  getProcessedPreload,
  latestPreload,
  preloadMetaSelect,
  TX_PRELOAD_INLINE_MAX,
  txSavedSelect,
} from '@/lib/preload-process'

async function loadPreloads(session) {
  const isHq = session.role === 'hq'

  const [txPreList, aggPreList] = await Promise.all([
    prisma.preload.findMany({ where: { type: 'tx' }, orderBy: { createdAt: 'desc' }, select: preloadMetaSelect }),
    prisma.preload.findMany({ where: { type: 'agg' }, orderBy: { createdAt: 'desc' }, select: preloadMetaSelect }),
  ])

  const currentTxPreload = latestPreload(txPreList, { hq: isHq })
  const currentAggPreload = latestPreload(aggPreList, { hq: isHq })

  const [txFull, aggFull] = await Promise.all([
    currentTxPreload
      ? prisma.preload.findUnique({
        where: { id: currentTxPreload.id },
        select: { data: true, updatedAt: true },
      })
      : null,
    currentAggPreload
      ? prisma.preload.findUnique({
        where: { id: currentAggPreload.id },
        select: { data: true, updatedAt: true },
      })
      : null,
  ])

  const txData = Array.isArray(txFull?.data) ? txFull.data : []
  const aggData = Array.isArray(aggFull?.data) ? aggFull.data : []

  const txProcessed = currentTxPreload
    ? getProcessedPreload(currentTxPreload.id, txFull?.updatedAt, 'tx', txData)
    : { preloadTx: [], aggIndicators: [] }

  const aggProcessed = currentAggPreload
    ? getProcessedPreload(currentAggPreload.id, aggFull?.updatedAt, 'agg', aggData)
    : { preloadAgg: [], aggIndicators: [] }

  let preloadTx = txProcessed.preloadTx
  let preloadAgg = aggProcessed.preloadAgg

  if (session.role === 'field' && session.state) {
    preloadTx = filterRowsByState(preloadTx, session.state)
    preloadAgg = filterRowsByState(preloadAgg, session.state)
  }

  const preloadTxLarge = preloadTx.length > TX_PRELOAD_INLINE_MAX
  const txIndex = preloadTxLarge ? buildTxIndex(preloadTx) : null

  return {
    activeTxPreload: currentTxPreload,
    activeAggPreload: currentAggPreload,
    preloadLocked: isHq
      ? Boolean(currentTxPreload || currentAggPreload)
      : Boolean(txPreList.some(p => p.locked) || aggPreList.some(p => p.locked)),
    preloadTx: preloadTxLarge ? [] : preloadTx,
    preloadTxLarge,
    txIndex,
    preloadAgg,
    aggIndicators: aggProcessed.aggIndicators,
  }
}

async function loadSaved(session) {
  const stateFilter = session.role === 'field' && session.state ? { state: session.state } : {}

  const [txSaved, aggSaved, issuesSaved] = await Promise.all([
    prisma.txValidation.findMany({ where: stateFilter, orderBy: { updatedAt: 'desc' }, select: txSavedSelect }),
    prisma.aggValidation.findMany({ where: stateFilter, orderBy: { updatedAt: 'desc' }, select: aggSavedSelect }),
    prisma.issue.findMany({ where: stateFilter, orderBy: { createdAt: 'desc' } }),
  ])

  return { txSaved, aggSaved, issuesSaved }
}

export async function GET(request) {
  const session = await getSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const part = searchParams.get('part') || 'preloads'

  if (part === 'saved') {
    return Response.json(await loadSaved(session))
  }

  if (part === 'all') {
    const [preloads, saved] = await Promise.all([loadPreloads(session), loadSaved(session)])
    return Response.json({ ...preloads, ...saved })
  }

  return Response.json(await loadPreloads(session))
}
