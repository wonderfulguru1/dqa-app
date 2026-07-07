'use client'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { unique } from '@/lib/arrays'
import {
  flushOfflineQueue,
  getOfflineQueue,
  isBrowserOnline,
  loadFieldDataCache,
  postOrQueue,
  savePreloadCache,
} from '@/lib/offline-store'
import EntryAlertToast from './EntryAlertToast'

const FieldEntryContext = createContext(null)

function applyPreloads(setters, data) {
  setters.setActiveTxPreload(data.activeTxPreload || null)
  setters.setActiveAggPreload(data.activeAggPreload || null)
  setters.setPreloadLocked(Boolean(data.preloadLocked))
  setters.setPreloadTx(data.preloadTx || [])
  setters.setPreloadAgg(data.preloadAgg || [])
  setters.setAggIndicators(data.aggIndicators || [])
  setters.setPreloadTxLarge(Boolean(data.preloadTxLarge))
  setters.setTxIndex(data.txIndex || null)
}

function applySaved(setters, data) {
  setters.setTxSaved(data.txSaved || [])
  setters.setAggSaved(data.aggSaved || [])
  setters.setIssuesSaved(data.issuesSaved || [])
}

export function FieldEntryProvider({ session, children }) {
  const [banner, setBanner] = useState(null)
  const [preloadTx, setPreloadTx] = useState([])
  const [preloadAgg, setPreloadAgg] = useState([])
  const [aggIndicators, setAggIndicators] = useState([])
  const [txSaved, setTxSaved] = useState([])
  const [aggSaved, setAggSaved] = useState([])
  const [issuesSaved, setIssuesSaved] = useState([])
  const [preloadLocked, setPreloadLocked] = useState(true)
  const [activeTxPreload, setActiveTxPreload] = useState(null)
  const [activeAggPreload, setActiveAggPreload] = useState(null)
  const [preloadTxLarge, setPreloadTxLarge] = useState(false)
  const [txIndex, setTxIndex] = useState(null)
  const [isOnline, setIsOnline] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [pendingEntries, setPendingEntries] = useState([])
  const [loading, setLoading] = useState(false)
  const [savedLoading, setSavedLoading] = useState(false)
  const initDone = useRef(false)

  const [globalAssessor, setGlobalAssessor] = useState(session?.name || '')
  const [globalState, setGlobalState] = useState('')
  const [globalFacility, setGlobalFacility] = useState('')

  const preloadSetters = useMemo(() => ({
    setActiveTxPreload,
    setActiveAggPreload,
    setPreloadLocked,
    setPreloadTx,
    setPreloadAgg,
    setAggIndicators,
    setPreloadTxLarge,
    setTxIndex,
  }), [])

  const savedSetters = useMemo(() => ({
    setTxSaved,
    setAggSaved,
    setIssuesSaved,
  }), [])

  const bannerTimer = useRef(null)

  const show = useCallback((msg, ok = true, { useAlert = false } = {}) => {
    setBanner({ msg, ok })
    if (bannerTimer.current) clearTimeout(bannerTimer.current)
    bannerTimer.current = setTimeout(() => setBanner(null), ok ? 4500 : 7000)
    if (useAlert && typeof window !== 'undefined') {
      window.alert(ok ? `Success: ${msg}` : `Error: ${msg}`)
    }
  }, [])

  const refreshPending = useCallback(() => {
    const queue = getOfflineQueue()
    setPendingCount(queue.length)
    setPendingEntries(queue)
  }, [])

  const hydrateFromCache = useCallback(() => {
    const cache = loadFieldDataCache()
    if (!cache?.preloadTx?.length && !cache?.txIndex) return false
    applyPreloads(preloadSetters, cache)
    return true
  }, [preloadSetters])

  const loadSaved = useCallback(async () => {
    if (!isBrowserOnline()) return
    setSavedLoading(true)
    try {
      const res = await fetch('/api/field/bootstrap?part=saved', { credentials: 'include' })
      if (!res.ok) return
      const data = await res.json()
      applySaved(savedSetters, data)
    } catch {
      // saved entries are optional for first paint
    } finally {
      setSavedLoading(false)
    }
  }, [savedSetters])

  const loadPreloads = useCallback(async ({ silent = false } = {}) => {
    if (!isBrowserOnline()) {
      hydrateFromCache()
      setLoading(false)
      return
    }

    if (!silent) setLoading(true)
    try {
      const res = await fetch('/api/field/bootstrap?part=preloads', { credentials: 'include' })
      if (!res.ok) throw new Error('Bootstrap failed')
      const data = await res.json()
      applyPreloads(preloadSetters, data)
      setTimeout(() => savePreloadCache(data), 0)
    } catch {
      hydrateFromCache()
    } finally {
      setLoading(false)
    }
  }, [hydrateFromCache, preloadSetters])

  const loadAll = useCallback(async ({ silent = false } = {}) => {
    if (!isBrowserOnline()) {
      hydrateFromCache()
      setLoading(false)
      return
    }

    if (!silent) setLoading(true)
    try {
      const res = await fetch('/api/field/bootstrap?part=all', { credentials: 'include' })
      if (!res.ok) throw new Error('Bootstrap failed')
      const data = await res.json()
      applyPreloads(preloadSetters, data)
      applySaved(savedSetters, data)
      setTimeout(() => savePreloadCache(data), 0)
    } catch {
      hydrateFromCache()
    } finally {
      setLoading(false)
    }
  }, [hydrateFromCache, preloadSetters, savedSetters])

  const syncNow = useCallback(async () => {
    if (!isBrowserOnline()) return { synced: 0, remaining: getOfflineQueue().length }
    setSyncing(true)
    try {
      const result = await flushOfflineQueue()
      refreshPending()
      if (result.synced > 0) {
        await loadSaved()
        show(`${result.synced} pending ${result.synced === 1 ? 'entry' : 'entries'} synced to the server.`)
      }
      return result
    } finally {
      setSyncing(false)
    }
  }, [loadSaved, refreshPending, show])

  const saveEntry = useCallback(async ({ type, url, body, label }) => {
    const result = await postOrQueue({ type, url, body, label })
    refreshPending()
    return result
  }, [refreshPending])

  const upsertTxSaved = useCallback((record) => {
    if (!record?.id) return
    setTxSaved(prev => {
      const idx = prev.findIndex(s => s.id === record.id)
      if (idx >= 0) {
        const existing = prev[idx]
        if (existing.updatedAt === record.updatedAt) return prev
        const next = [...prev]
        next[idx] = record
        return next
      }
      return [record, ...prev]
    })
  }, [])

  const upsertAggSaved = useCallback((records) => {
    const list = Array.isArray(records) ? records : [records]
    const valid = list.filter(r => r?.id)
    if (!valid.length) return
    setAggSaved(prev => {
      let next = [...prev]
      for (const record of valid) {
        const idx = next.findIndex(s => s.id === record.id)
        if (idx >= 0) {
          if (next[idx].updatedAt === record.updatedAt) continue
          next[idx] = record
        } else {
          next = [record, ...next]
        }
      }
      return next
    })
  }, [])

  const upsertIssueSaved = useCallback((record) => {
    if (!record?.id) return
    setIssuesSaved(prev => {
      const idx = prev.findIndex(s => s.id === record.id)
      if (idx >= 0) {
        const existing = prev[idx]
        if (existing.updatedAt === record.updatedAt) return prev
        const next = [...prev]
        next[idx] = record
        return next
      }
      return [record, ...prev]
    })
  }, [])

  useEffect(() => {
    if (initDone.current) return
    initDone.current = true

    const hadCache = hydrateFromCache()
    loadAll({ silent: hadCache })
  }, [hydrateFromCache, loadAll])

  useEffect(() => {
    const onOnline = () => setIsOnline(true)
    const onOffline = () => setIsOnline(false)
    const onQueueChange = () => refreshPending()

    setIsOnline(isBrowserOnline())
    refreshPending()

    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    window.addEventListener('dqa-queue-changed', onQueueChange)

    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('dqa-queue-changed', onQueueChange)
    }
  }, [refreshPending])

  useEffect(() => {
    if (!isOnline || loading) return
    if (getOfflineQueue().length === 0) return

    const timer = setTimeout(() => { syncNow() }, 400)
    return () => clearTimeout(timer)
  }, [isOnline, loading, syncNow])

  const fieldState = session?.role === 'field' ? String(session?.state || '').trim() : ''

  const states = useMemo(() => {
    const fromTx = txIndex?.states?.length
      ? txIndex.states
      : unique(preloadTx.map(r => r.state).filter(Boolean))
    const fromAgg = unique(preloadAgg.map(r => r.state).filter(Boolean))
    const merged = unique([...fromTx, ...fromAgg])
    if (fieldState && !merged.includes(fieldState)) return [fieldState, ...merged]
    return merged
  }, [preloadTx, preloadAgg, txIndex, fieldState])

  const facilities = useMemo(() => {
    if (txIndex?.facilitiesByState) {
      if (!globalState) return []
      return txIndex.facilitiesByState[globalState] || []
    }
    const fromTx = preloadTx
      .filter(r => !globalState || r.state === globalState)
      .map(r => r.facilityName)
    const fromAgg = preloadAgg
      .filter(r => !globalState || r.state === globalState)
      .map(r => r.facilityName)
    return unique([...fromTx, ...fromAgg].filter(Boolean))
  }, [preloadTx, preloadAgg, txIndex, globalState])

  useEffect(() => {
    if (fieldState) {
      setGlobalState(fieldState)
      return
    }
    if (!preloadTx.length && !preloadAgg.length) {
      setGlobalState('')
      setGlobalFacility('')
      return
    }
    setGlobalState(prev => (prev && states.includes(prev) ? prev : states[0] || ''))
  }, [preloadTx, preloadAgg, states, fieldState])

  useEffect(() => {
    if (!globalState) {
      setGlobalFacility('')
      return
    }
    setGlobalFacility(prev => (prev && facilities.includes(prev) ? prev : facilities[0] || ''))
  }, [globalState, facilities])

  const defaultPeriod = useMemo(
    () => activeTxPreload?.period || preloadTx[0]?.dqaPeriod || activeAggPreload?.period || preloadAgg[0]?.dqaPeriod || '',
    [activeTxPreload, activeAggPreload, preloadTx, preloadAgg],
  )

  const value = useMemo(() => ({
    session,
    banner,
    show,
    preloadTx,
    preloadAgg,
    preloadTxLarge,
    txIndex,
    aggIndicators,
    txSaved,
    aggSaved,
    issuesSaved,
    preloadLocked,
    activeTxPreload,
    activeAggPreload,
    loadAll,
    loadSaved,
    loading,
    savedLoading,
    globalAssessor,
    setGlobalAssessor,
    globalState,
    setGlobalState,
    globalFacility,
    setGlobalFacility,
    states,
    facilities,
    defaultPeriod,
    isOnline,
    pendingCount,
    pendingEntries,
    syncing,
    syncNow,
    saveEntry,
    upsertTxSaved,
    upsertAggSaved,
    upsertIssueSaved,
  }), [
    session, banner, show, preloadTx, preloadAgg, preloadTxLarge, txIndex, aggIndicators,
    txSaved, aggSaved, issuesSaved, preloadLocked, activeTxPreload, activeAggPreload,
    loadAll, loadSaved, loading, savedLoading, globalAssessor, globalState, globalFacility,
    states, facilities, defaultPeriod, isOnline, pendingCount, pendingEntries, syncing,
    syncNow, saveEntry, upsertTxSaved, upsertAggSaved, upsertIssueSaved,
  ])

  return (
    <FieldEntryContext.Provider value={value}>
      <EntryAlertToast banner={banner} />
      {children}
    </FieldEntryContext.Provider>
  )
}

export function useFieldEntry() {
  const ctx = useContext(FieldEntryContext)
  if (!ctx) throw new Error('useFieldEntry must be used within FieldEntryProvider')
  return ctx
}
