'use client'
import { useFieldEntry } from './FieldEntryContext'
import OfflineStatusBar from './OfflineStatusBar'
import FieldSectionSkeleton from './FieldSectionSkeleton'

export default function FieldEntryChrome() {
  const {
    session,
    banner,
    loading,
    preloadTx,
    preloadAgg,
    preloadLocked,
    txIndex,
    activeTxPreload,
    globalAssessor,
    setGlobalAssessor,
    globalState,
    setGlobalState,
    globalFacility,
    setGlobalFacility,
    states,
    facilities,
  } = useFieldEntry()

  const fieldState = session?.role === 'field' ? String(session?.state || '').trim() : ''
  const stateLocked = Boolean(fieldState)

  const lineListLabel = activeTxPreload
    ? `Line list #${activeTxPreload.id}${activeTxPreload.period ? ` · ${activeTxPreload.period}` : ''}`
    : loading ? 'Loading line list…' : 'No TX line list uploaded'

  const txRowCount = txIndex?.totalRows ?? preloadTx.length
  const preloadReady = !loading || txRowCount > 0 || preloadAgg.length > 0

  return (
    <>
      <OfflineStatusBar />
      <div className="grid2">
        <div className="entry-card">
          <div className="entry-section"><h3>HQ preload status</h3><span className="muted">{lineListLabel}</span></div>
          {preloadReady ? (
            <div className="note">
              {txRowCount || preloadAgg.length
                ? `${txRowCount} TX client row(s) from the current line list and ${preloadAgg.length} aggregate facility row(s) from the latest aggregate preload. State and facility filters below are loaded from the uploaded line list.`
                : fieldState
                  ? preloadLocked
                    ? `No preload rows are available for ${fieldState} yet. Ask HQ to upload and lock TX and aggregate preloads that include ${fieldState} data.`
                    : `Preloads exist but are not locked for field use yet. Ask HQ to lock the TX and aggregate preloads in Data Management. Your account is scoped to ${fieldState} only.`
                  : 'No line list available yet. Upload and lock an EMR line list via Data Management, or upload a TX file if you are testing as HQ.'}
            </div>
          ) : (
            <FieldSectionSkeleton rows={2} />
          )}
        </div>
        <div className="entry-card">
          <div className="entry-section"><h3>General controls</h3><span className="muted">From uploaded line list</span></div>
          {preloadReady ? (
            <div className="grid3">
              <div>
                <label className="label-required">Assessor</label>
                <input value={globalAssessor} onChange={e => setGlobalAssessor(e.target.value)} placeholder="Required for all saves" />
              </div>
              <div>
                <label>Selected state</label>
                {stateLocked ? (
                  <input readOnly value={fieldState} title="Your account is limited to this state" />
                ) : (
                  <select
                    value={globalState}
                    onChange={e => { setGlobalState(e.target.value); setGlobalFacility('') }}
                    disabled={!states.length}
                  >
                    <option value="">{states.length ? 'Select state' : 'No states in line list'}</option>
                    {states.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                )}
              </div>
              <div>
                <label>Selected facility</label>
                <select
                  value={globalFacility}
                  onChange={e => setGlobalFacility(e.target.value)}
                  disabled={!facilities.length}
                >
                  <option value="">{facilities.length ? 'Select facility' : globalState ? 'No facilities for state' : 'Select state first'}</option>
                  {facilities.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
            </div>
          ) : (
            <FieldSectionSkeleton rows={3} />
          )}
        </div>
      </div>

      {banner && <div className={`entry-banner ${banner.ok ? 'ok' : 'err'}`}>{banner.msg}</div>}
    </>
  )
}
