import { canonicalTxRow, canonicalAggRow, detectAggIndicators, norm } from './dqa-entry.js'

const processedCache = new Map()
const CACHE_MAX = 12

function cacheKey(id, updatedAt) {
  return `${id}:${updatedAt?.toISOString?.() || updatedAt}`
}

function trimCache() {
  if (processedCache.size <= CACHE_MAX) return
  const drop = processedCache.size - CACHE_MAX
  const keys = [...processedCache.keys()]
  for (let i = 0; i < drop; i++) processedCache.delete(keys[i])
}

function isCanonicalTxRow(r) {
  return r && typeof r === 'object' && 'dqaPeriod' in r && 'facilityName' in r && !('DQA Period' in r)
}

function isCanonicalAggRow(r) {
  return r && typeof r === 'object' && 'dqaPeriod' in r && 'facilityName' in r && !('DQA Period' in r)
}

export function processTxPreloadData(data) {
  if (!Array.isArray(data) || !data.length) return []
  if (isCanonicalTxRow(data[0])) {
    return data.map(r => {
      const { raw, ...rest } = r
      return rest
    })
  }
  return data.map(canonicalTxRow)
}

export function processAggPreloadData(data) {
  if (!Array.isArray(data) || !data.length) return []
  if (isCanonicalAggRow(data[0])) {
    return data.map(r => {
      const { raw, ...rest } = r
      return rest
    })
  }
  return data.map(canonicalAggRow)
}

export function getProcessedPreload(id, updatedAt, type, rawData) {
  const key = cacheKey(id, updatedAt)
  const hit = processedCache.get(key)
  if (hit) return hit

  const rows = type === 'tx'
    ? processTxPreloadData(rawData)
    : processAggPreloadData(rawData)

  const result = type === 'tx'
    ? { preloadTx: rows, aggIndicators: [] }
    : {
      preloadAgg: rows,
      aggIndicators: (() => {
        const indicators = detectAggIndicators(rows)
        return indicators?.length ? indicators : []
      })(),
    }

  processedCache.set(key, result)
  trimCache()
  return result
}

export function filterRowsByState(rows, state) {
  if (!state || !rows?.length) return rows || []
  const want = norm(state)
  return rows.filter(r => norm(r.state) === want)
}

export function latestPreload(list, { hq }) {
  const sorted = [...(Array.isArray(list) ? list : [])].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
  )
  if (hq) return sorted[0] || null
  return sorted.find(p => p.locked) || null
}

export const TX_PRELOAD_INLINE_MAX = 1500

export function buildTxIndex(rows) {
  const states = []
  const stateSet = new Set()
  const facilitiesByState = {}

  for (const r of rows) {
    const s = r.state
    const f = r.facilityName
    if (!s || !f) continue
    if (!stateSet.has(s)) {
      stateSet.add(s)
      states.push(s)
    }
    if (!facilitiesByState[s]) facilitiesByState[s] = new Set()
    facilitiesByState[s].add(f)
  }

  return {
    states,
    facilitiesByState: Object.fromEntries(
      Object.entries(facilitiesByState).map(([s, set]) => [s, [...set].sort()]),
    ),
    totalRows: rows.length,
  }
}

export const preloadMetaSelect = {
  id: true,
  type: true,
  period: true,
  state: true,
  uploadedBy: true,
  locked: true,
  createdAt: true,
  updatedAt: true,
}

export const txSavedSelect = {
  id: true,
  period: true,
  periodFy: true,
  state: true,
  lga: true,
  facilityName: true,
  datimCode: true,
  patientId: true,
  pepId: true,
  patientHospitalNo: true,
  assessor: true,
  assessmentDate: true,
  recordFound: true,
  emrSex: true,
  emrAge: true,
  emrArtStartDate: true,
  emrRegimenLine: true,
  emrRegimen: true,
  emrPharmacyPickup: true,
  emrDaysRefill: true,
  emrTbStatus: true,
  emrPregnancy: true,
  folderSex: true,
  folderAge: true,
  folderArtStartDate: true,
  folderRegimenLine: true,
  folderRegimen: true,
  folderPharmacyPickup: true,
  folderDaysRefill: true,
  folderTbStatus: true,
  folderPregnancy: true,
  folderCompleteCount: true,
  folderCompletenessPct: true,
  matchCount: true,
  concurrencePct: true,
  emrOnlyCompleteCount: true,
  emrOnlyPct: true,
  pbsEmr: true,
  pbsCompleteness: true,
  recaptureEmr: true,
  recaptureCompleteness: true,
  recaptureDate: true,
  recaptureDateComplete: true,
  recaptureDateValid: true,
  remarks: true,
  mismatchResolutions: true,
  updatedAt: true,
}

export const aggSavedSelect = {
  id: true,
  period: true,
  periodFy: true,
  state: true,
  lga: true,
  facilityName: true,
  datimCode: true,
  assessor: true,
  assessmentDate: true,
  indicator: true,
  reported: true,
  validated: true,
  concurrencePct: true,
  classification: true,
  mismatchResolution: true,
  updatedAt: true,
}
