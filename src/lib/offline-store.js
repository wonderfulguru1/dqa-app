const QUEUE_KEY = 'dqa_offline_queue'
const CACHE_KEY = 'dqa_field_data_cache'

function notifyQueueChange() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('dqa-queue-changed'))
  }
}

export function isBrowserOnline() {
  return typeof navigator === 'undefined' ? true : navigator.onLine
}

export function getOfflineQueue() {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveOfflineQueue(queue) {
  if (typeof window === 'undefined') return
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
  notifyQueueChange()
}

export function enqueueOfflineEntry({ type, url, body, label }) {
  const entry = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `q-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type,
    url,
    body,
    label: label || type,
    createdAt: new Date().toISOString(),
  }
  const queue = getOfflineQueue()
  queue.push(entry)
  saveOfflineQueue(queue)
  return entry
}

export function removeOfflineEntry(id) {
  saveOfflineQueue(getOfflineQueue().filter(item => item.id !== id))
}

export function saveFieldDataCache(data) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ...data, cachedAt: new Date().toISOString() }))
  } catch {
    // storage full — ignore
  }
}

/** Cache only line-list data (not saved validations) to keep localStorage small. */
export function savePreloadCache(data) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      activeTxPreload: data.activeTxPreload || null,
      activeAggPreload: data.activeAggPreload || null,
      preloadLocked: Boolean(data.preloadLocked),
      preloadTx: data.preloadTx || [],
      preloadAgg: data.preloadAgg || [],
      aggIndicators: data.aggIndicators || [],
      preloadTxLarge: Boolean(data.preloadTxLarge),
      txIndex: data.txIndex || null,
      cachedAt: new Date().toISOString(),
    }))
  } catch {
    // storage full — ignore
  }
}

export function loadFieldDataCache() {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

async function tryPost(url, body) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) {
    const err = new Error(data.error || `Save failed (${r.status})`)
    err.status = r.status
    throw err
  }
  return data
}

export async function postOrQueue({ type, url, body, label }) {
  if (!isBrowserOnline()) {
    const entry = enqueueOfflineEntry({ type, url, body, label })
    return { ok: true, queued: true, offline: true, entry }
  }

  try {
    const data = await tryPost(url, body)
    return { ok: true, queued: false, offline: false, data }
  } catch (err) {
    // Auth/validation errors should surface to the user, not hide in offline queue.
    if (err.status) {
      return { ok: false, queued: false, offline: false, error: err.message, status: err.status }
    }
    const entry = enqueueOfflineEntry({ type, url, body, label })
    return { ok: true, queued: true, offline: true, entry, networkError: true }
  }
}

export async function flushOfflineQueue() {
  if (!isBrowserOnline()) {
    return { synced: 0, failed: 0, remaining: getOfflineQueue().length }
  }

  const queue = getOfflineQueue()
  let synced = 0
  let failed = 0

  for (const item of queue) {
    try {
      await tryPost(item.url, item.body)
      removeOfflineEntry(item.id)
      synced++
    } catch (err) {
      if (err.status && err.status >= 400 && err.status < 500) {
        removeOfflineEntry(item.id)
      }
      failed++
      break
    }
  }

  return { synced, failed, remaining: getOfflineQueue().length }
}
