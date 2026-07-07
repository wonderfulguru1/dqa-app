'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  calcAggRow, fmtDate, aggClassificationKpiClass, resolveAssessor, ASSESSOR_REQUIRED_MSG,
  filterSavedAggRecords, savedAggRowsToForm, resolutionsFromAggRows,
} from '@/lib/dqa-entry'
import {
  EMPTY_MISMATCH_RESOLUTION,
  isResolutionComplete,
  normalizeResolutionMap,
  normalizeSingleResolution,
} from '@/lib/mismatch-resolution'
import EntryBadge from '../EntryBadge'
import SavePreviewModal, { SavePreviewSections } from '../SavePreviewModal'
import ConcurrencePreviewTable from '../ConcurrencePreviewTable'
import MismatchResolutionModal from '../MismatchResolutionModal'
import { useFieldEntry } from '../FieldEntryContext'
import SuspenseSection from '../SuspenseSection'

function isReportedBlank(reported) {
  return reported === null || reported === undefined || String(reported).trim() === ''
}

const disabledFieldStyle = { background: '#f1f5f9' }

export default function FieldAggView() {
  const {
    show, loadSaved, preloadAgg, aggIndicators, aggSaved, loading: bootstrapLoading, globalState, globalFacility, globalAssessor, saveEntry,
    upsertAggSaved,
  } = useFieldEntry()

  const [aggFacilityIdx, setAggFacilityIdx] = useState('')
  const [aggAssessmentDate, setAggAssessmentDate] = useState('')
  const [aggAssessor, setAggAssessor] = useState('')
  const [aggValidated, setAggValidated] = useState({})
  const [hasSavedEntry, setHasSavedEntry] = useState(false)
  const [loadingSaved, setLoadingSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [aggPreviewOpen, setAggPreviewOpen] = useState(false)
  const [pendingAggSave, setPendingAggSave] = useState(null)
  const [mismatchResolutions, setMismatchResolutions] = useState({})
  const [resolutionDraft, setResolutionDraft] = useState(EMPTY_MISMATCH_RESOLUTION)
  const [resolutionTarget, setResolutionTarget] = useState(null)

  const aggFacilities = useMemo(() => preloadAgg.filter(r =>
    (!globalState || r.state === globalState) &&
    (!globalFacility || r.facilityName === globalFacility)
  ), [preloadAgg, globalState, globalFacility])

  const selectedAgg = aggFacilityIdx !== '' ? aggFacilities[+aggFacilityIdx] : null

  const selectedAggKey = useMemo(() => {
    if (!selectedAgg) return ''
    return [selectedAgg.facilityName, selectedAgg.dqaPeriod, selectedAgg.state].join('|')
  }, [selectedAgg])

  const aggSavedRef = useRef(aggSaved)
  aggSavedRef.current = aggSaved

  const selectedAggRef = useRef(selectedAgg)
  selectedAggRef.current = selectedAgg

  const globalStateRef = useRef(globalState)
  globalStateRef.current = globalState

  const applySavedAggRecordsRef = useRef(null)
  const upsertAggSavedRef = useRef(upsertAggSaved)
  upsertAggSavedRef.current = upsertAggSaved

  const applySavedAggRecords = useCallback((rows) => {
    if (!rows?.length) {
      setHasSavedEntry(false)
      setAggValidated({})
      setMismatchResolutions({})
      setAggAssessor('')
      setAggAssessmentDate(fmtDate(new Date()))
      return
    }
    setHasSavedEntry(true)
    const f = savedAggRowsToForm(rows)
    setAggValidated(f.validated)
    setMismatchResolutions(normalizeResolutionMap(f.mismatchResolutions))
    if (f.assessor) setAggAssessor(f.assessor)
    if (f.assessmentDate) setAggAssessmentDate(f.assessmentDate)
  }, [])

  applySavedAggRecordsRef.current = applySavedAggRecords

  useEffect(() => {
    if (!aggAssessmentDate) setAggAssessmentDate(fmtDate(new Date()))
  }, [aggAssessmentDate])

  useEffect(() => {
    const facility = selectedAggRef.current
    if (!selectedAggKey || !facility) {
      setHasSavedEntry(false)
      setLoadingSaved(false)
      if (!facility) {
        setAggValidated({})
        setMismatchResolutions({})
      }
      return
    }

    const state = globalStateRef.current || facility.state
    const cached = filterSavedAggRecords(
      facility.facilityName,
      facility.dqaPeriod,
      state,
      aggSavedRef.current,
    )
    if (cached.length) {
      applySavedAggRecordsRef.current?.(cached)
    } else {
      setHasSavedEntry(false)
      setAggValidated({})
      setMismatchResolutions({})
    }

    let cancelled = false
    setLoadingSaved(!cached.length)

    const params = new URLSearchParams({ facilityName: facility.facilityName || '' })
    if (facility.dqaPeriod) params.set('period', facility.dqaPeriod)
    if (state) params.set('state', state)

    fetch(`/api/agg?${params}`, { credentials: 'include' })
      .then(r => (r.ok ? r.json() : []))
      .then(list => {
        if (cancelled) return
        const fromServer = filterSavedAggRecords(
          facility.facilityName,
          facility.dqaPeriod,
          state,
          list,
        )
        applySavedAggRecordsRef.current?.(fromServer)
        if (fromServer.length) upsertAggSavedRef.current(fromServer)
      })
      .catch(() => {
        if (!cancelled && !cached.length) applySavedAggRecordsRef.current?.([])
      })
      .finally(() => {
        if (!cancelled) setLoadingSaved(false)
      })

    return () => { cancelled = true }
  }, [selectedAggKey])

  const aggIndList = useMemo(() => {
    if (!selectedAgg) return []
    if (aggIndicators?.length) {
      return aggIndicators.map(ind => ({
        base: ind.replace(' (Reported)', ''),
        reported: selectedAgg[ind],
      }))
    }
    const ind = selectedAgg.Indicator || selectedAgg.indicator
    if (ind) {
      return [{ base: ind, reported: selectedAgg['Reported Value'] ?? selectedAgg.Reported ?? selectedAgg.reported }]
    }
    return Object.entries(selectedAgg)
      .filter(([k]) => !['raw', 'dqaPeriod', 'state', 'lga', 'facilityName', 'DQA Period', 'State', 'LGA', 'FacilityName'].includes(k))
      .filter(([, v]) => typeof v === 'number' || (typeof v === 'string' && v !== '' && !isNaN(Number(v))))
      .slice(0, 20)
      .map(([base, reported]) => ({ base, reported }))
  }, [selectedAgg, aggIndicators])

  const aggMetrics = useMemo(() => {
    let audited = 0
    let accurate = 0
    let under = 0
    let over = 0
    let totalReported = 0
    let totalValidated = 0
    for (const { base, reported } of aggIndList) {
      if (isReportedBlank(reported)) continue
      const val = aggValidated[base]
      if (val === '' || val === undefined || val === null) continue
      audited++
      totalReported += Number(reported ?? 0)
      totalValidated += Number(val)
      const { cls } = calcAggRow(reported, val)
      if (cls === 'Accurately reported') accurate++
      else if (cls === 'Under-reported') under++
      else if (cls === 'Over-reported') over++
    }
    const weightedConc = totalValidated > 0 ? totalReported / totalValidated * 100 : null
    return {
      audited,
      accurate,
      under,
      over,
      totalReported,
      totalValidated,
      weightedConc,
      accuratePct: audited > 0 ? (accurate / audited * 100).toFixed(1) : null,
    }
  }, [aggIndList, aggValidated])

  const weightedConcClass = aggMetrics.audited > 0
    ? aggClassificationKpiClass(aggMetrics.totalReported, aggMetrics.totalValidated)
    : ''

  function buildAggSaveItems(assessor) {
    const items = []
    if (aggIndicators?.length) {
      aggIndicators.forEach(ind => {
        const base = ind.replace(' (Reported)', '')
        const val = aggValidated[base]
        if (val === '' || val === undefined || val === null) return
        const rep = selectedAgg[ind]
        if (isReportedBlank(rep)) return
        const { cls, conc, concNum } = calcAggRow(rep, val)
        items.push({
          period: selectedAgg.dqaPeriod,
          periodFy: selectedAgg.periodFy,
          state: selectedAgg.state,
          lga: selectedAgg.lga,
          facilityName: selectedAgg.facilityName,
          datimCode: selectedAgg.datimCode,
          assessor,
          assessmentDate: aggAssessmentDate,
          indicator: base,
          reported: Number(rep ?? 0),
          validated: Number(val),
          concurrencePct: concNum,
          classification: cls,
          previewConc: conc,
          mismatchResolution: normalizeSingleResolution(mismatchResolutions[base]),
        })
      })
    } else {
      const ind = selectedAgg.Indicator || selectedAgg.indicator
      const rep = selectedAgg['Reported Value'] ?? selectedAgg.Reported ?? selectedAgg.reported
      const val = aggValidated[ind]
      if (val !== '' && val !== undefined && !isReportedBlank(rep)) {
        const { cls, conc, concNum } = calcAggRow(rep, val)
        items.push({
          period: selectedAgg.dqaPeriod,
          periodFy: selectedAgg.periodFy,
          state: selectedAgg.state,
          lga: selectedAgg.lga,
          facilityName: selectedAgg.facilityName,
          datimCode: selectedAgg.datimCode,
          assessor,
          assessmentDate: aggAssessmentDate,
          indicator: ind,
          reported: Number(rep ?? 0),
          validated: Number(val),
          concurrencePct: concNum,
          classification: cls,
          previewConc: conc,
          mismatchResolution: normalizeSingleResolution(mismatchResolutions[ind]),
        })
      }
    }
    return items
  }

  function requestSaveAgg() {
    if (!selectedAgg) { show('Select a preloaded aggregate facility first.', false); return }
    const assessor = resolveAssessor(aggAssessor, globalAssessor)
    if (!assessor) {
      show(ASSESSOR_REQUIRED_MSG, false, { useAlert: true })
      return
    }
    const items = buildAggSaveItems(assessor)
    if (!items.length) { show('Enter at least one validated indicator value first.', false); return }

    const label = `Aggregate · ${selectedAgg.facilityName}`
    const concurrenceRows = items.map(item => ({
      key: item.indicator,
      label: item.indicator,
      emr: String(item.reported),
      folder: String(item.validated),
      status: item.classification,
      isMismatch: item.classification !== 'Accurately reported',
    }))

    setResolutionTarget(null)
    setPendingAggSave({
      items: items.map(({ previewConc, ...item }) => item),
      label,
      previewItems: items,
      concurrenceRows,
      assessor,
      sections: [
        {
          title: 'Facility & assessment',
          rows: [
            ['DQA period', selectedAgg.dqaPeriod || '—'],
            ['State', selectedAgg.state || '—'],
            ['LGA', selectedAgg.lga || '—'],
            ['Facility', selectedAgg.facilityName || '—'],
            ['Assessor', assessor],
            ['Date of assessment', aggAssessmentDate || '—'],
            ['Rows to save', String(items.length)],
            ['Overall weighted concurrence %', aggMetrics.weightedConc != null ? `${aggMetrics.weightedConc.toFixed(1)}%` : '—'],
          ],
        },
      ],
    })
    setAggPreviewOpen(true)
  }

  async function confirmSaveAgg() {
    if (!pendingAggSave) return
    const mismatchRows = (pendingAggSave.concurrenceRows || []).filter(r => r.isMismatch)
    const unresolved = mismatchRows.filter(r => !isResolutionComplete(mismatchResolutions[r.key]))
    if (unresolved.length) {
      show('Resolve all discrepancies before saving.', false, { useAlert: true })
      return
    }

    setSaving(true)
    try {
      const assessor = pendingAggSave.assessor
      const items = buildAggSaveItems(assessor).map(({ previewConc, ...item }) => item)
      const { label } = pendingAggSave
      const result = await saveEntry({ type: 'agg', url: '/api/agg', body: items, label })
      if (result.error) {
        show(result.error, false, { useAlert: true })
        return
      }
      const savedResolutions = items.reduce((out, item) => {
        if (item.mismatchResolution && item.indicator) {
          out[item.indicator] = item.mismatchResolution
        }
        return out
      }, {})
      if (result.queued) {
        show(`${items.length} row(s) saved on this device. Will sync when internet is available.`, true, { useAlert: true })
        setMismatchResolutions(normalizeResolutionMap(savedResolutions))
        setHasSavedEntry(true)
      } else {
        if (Array.isArray(result.data) && result.data.length) {
          upsertAggSaved(result.data)
          const fromServer = resolutionsFromAggRows(result.data)
          const hasServerResolutions = Object.keys(fromServer).length > 0
          setMismatchResolutions(normalizeResolutionMap(
            hasServerResolutions ? fromServer : savedResolutions,
          ))
        } else {
          setMismatchResolutions(normalizeResolutionMap(savedResolutions))
        }
        setHasSavedEntry(true)
        show(`${items.length} aggregate validation row(s) saved successfully.`, true, { useAlert: true })
        await loadSaved()
      }
      setAggPreviewOpen(false)
      setPendingAggSave(null)
      setResolutionTarget(null)
    } catch {
      show('Save failed.', false, { useAlert: true })
    } finally {
      setSaving(false)
    }
  }

  function closeAggPreview() {
    if (saving) return
    setAggPreviewOpen(false)
    setPendingAggSave(null)
    setResolutionTarget(null)
  }

  function openResolution(row) {
    setResolutionTarget(row)
    setResolutionDraft(mismatchResolutions[row.key] || { ...EMPTY_MISMATCH_RESOLUTION })
  }

  function saveResolutionDraft() {
    if (!resolutionTarget) return
    if (!isResolutionComplete(resolutionDraft)) {
      show('Issues/gaps is required in the resolution form.', false, { useAlert: true })
      return
    }
    setMismatchResolutions(prev => ({ ...prev, [resolutionTarget.key]: { ...resolutionDraft } }))
    setResolutionTarget(null)
  }

  const aggMismatchRows = (pendingAggSave?.concurrenceRows || []).filter(r => r.isMismatch)
  const aggCanConfirmSave = aggMismatchRows.every(r => isResolutionComplete(mismatchResolutions[r.key]))
  const aggShowConcurrenceTable = (pendingAggSave?.concurrenceRows || []).length > 0
  const preloadPending = bootstrapLoading && !aggFacilities.length

  return (
    <>
      <div className="tx-scorecard-bar">
        <div className="entry-section tx-scorecard-heading">
          <h3>Validation scorecard</h3>
          <span className="muted">Updates as you enter validated indicator values</span>
        </div>
        <div className="grid4 tx-scorecard-grid">
          <div className="entry-card entry-kpi">
            <div className="k">Audited indicators</div>
            <div className="v">{aggMetrics.audited}</div>
            <div className="s">Indicators with validated values entered</div>
          </div>
          <div className="entry-card entry-kpi">
            <div className="k">Accurately reported</div>
            <div className="v entry-kpi-good">{aggMetrics.accurate}</div>
            <div className="s">
              {aggMetrics.accuratePct != null
                ? `${aggMetrics.accuratePct}% indicator rows at 100%`
                : 'Enter validated values to calculate'}
            </div>
          </div>
          <div className="entry-card entry-kpi">
            <div className="k">Under-reported</div>
            <div className={`v${aggMetrics.under > 0 ? ' entry-kpi-warn' : ''}`}>{aggMetrics.under}</div>
            <div className="s">Validated count higher than reported</div>
          </div>
          <div className="entry-card entry-kpi">
            <div className="k">Over-reported</div>
            <div className={`v${aggMetrics.over > 0 ? ' entry-kpi-bad' : ''}`}>{aggMetrics.over}</div>
            <div className="s">Reported count higher than validated</div>
          </div>
        </div>
        <div className="grid3 agg-scorecard-totals">
          <div className="entry-card entry-kpi">
            <div className="k">Total reporting</div>
            <div className="v">{aggMetrics.audited > 0 ? aggMetrics.totalReported.toLocaleString() : '—'}</div>
            <div className="s">Sum of DHIS reported values audited</div>
          </div>
          <div className="entry-card entry-kpi">
            <div className="k">Total validated</div>
            <div className="v">{aggMetrics.audited > 0 ? aggMetrics.totalValidated.toLocaleString() : '—'}</div>
            <div className="s">Sum of on-site validated counts</div>
          </div>
          <div className="entry-card entry-kpi">
            <div className="k">Overall weighted concurrence %</div>
            <div className={`v${weightedConcClass ? ` ${weightedConcClass}` : ''}`}>
              {aggMetrics.weightedConc != null ? `${aggMetrics.weightedConc.toFixed(1)}%` : '—'}
            </div>
            <div className="s">Total reporting ÷ total validated</div>
          </div>
        </div>
      </div>

      <SuspenseSection pending={preloadPending} rows={5}>
      <div className="grid4">
        <div className="entry-card">
          <label>Preloaded aggregate facility</label>
          <select value={aggFacilityIdx} onChange={e => { setAggFacilityIdx(e.target.value) }}>
            <option value="">{aggFacilities.length ? 'Select facility' : 'No preloaded aggregate rows'}</option>
            {aggFacilities.map((r, i) => <option key={i} value={i}>{r.facilityName}</option>)}
          </select>
        </div>
        <div className="entry-card"><label>DQA Period</label><input readOnly value={selectedAgg?.dqaPeriod || ''} /></div>
        <div className="entry-card"><label>Date of Assessment</label><input type="date" value={aggAssessmentDate} onChange={e => setAggAssessmentDate(e.target.value)} /></div>
        <div className="entry-card"><label className="label-required">Assessor</label><input value={aggAssessor} onChange={e => setAggAssessor(e.target.value)} placeholder="Or set in General controls above" /></div>
      </div>
      <div className="grid3 mt12">
        <div className="entry-card"><label>State</label><input readOnly value={selectedAgg?.state || ''} /></div>
        <div className="entry-card"><label>LGA</label><input readOnly value={selectedAgg?.lga || ''} /></div>
        <div className="entry-card"><label>Facility</label><input readOnly value={selectedAgg?.facilityName || ''} /></div>
      </div>
      <SuspenseSection pending={loadingSaved} rows={5}>
      <div className="entry-card mt12">
        <div className="entry-section">
          <h3>Preloaded DHIS reported values and on-site validated values</h3>
          <span className="muted">
            {hasSavedEntry
              ? 'Saved entry loaded — edit and save again to update'
              : 'Validated is disabled when DHIS reported value is blank'}
          </span>
        </div>
        <div className="tableWrap tall">
          <table>
            <thead>
              <tr><th>Indicator</th><th>Reported (DHIS)</th><th>Validated</th><th>Concurrence %</th><th>Classification</th></tr>
            </thead>
            <tbody>
              {!aggIndList.length ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)', padding: '1rem' }}>Select a facility to load indicators.</td></tr>
              ) : aggIndList.map(({ base, reported }) => {
                const reportedBlank = isReportedBlank(reported)
                const val = reportedBlank ? '' : (aggValidated[base] ?? '')
                const { conc, cls } = reportedBlank ? { conc: '', cls: '' } : calcAggRow(reported, val)
                return (
                  <tr key={base}>
                    <td style={{ fontWeight: 600 }}>{base}</td>
                    <td>{reportedBlank ? '' : reported}</td>
                    <td>
                      <input
                        type="number"
                        step="any"
                        value={val}
                        disabled={reportedBlank}
                        readOnly={reportedBlank}
                        onChange={e => setAggValidated(v => ({ ...v, [base]: e.target.value }))}
                        style={{ width: 100, padding: '6px 8px', ...(reportedBlank ? disabledFieldStyle : {}) }}
                        title={reportedBlank ? 'No DHIS reported value for this indicator' : ''}
                      />
                    </td>
                    <td>{conc}</td>
                    <td><EntryBadge text={cls} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="inlineActions mt12">
          <button type="button" className="entry-btn" onClick={requestSaveAgg} disabled={saving}>{saving ? 'Saving…' : 'Save validated aggregate rows'}</button>
          <button type="button" className="entry-btn secondary" onClick={() => setAggValidated({})}>Clear current validated inputs</button>
        </div>
      </div>
      </SuspenseSection>
      </SuspenseSection>

      <SavePreviewModal
        open={aggPreviewOpen}
        title="Preview aggregate validation save"
        subtitle={
          aggMismatchRows.length
            ? 'Review indicator concurrence below. Resolve each discrepancy, then confirm save.'
            : 'All indicators match. Review and confirm save.'
        }
        onClose={closeAggPreview}
        onConfirm={confirmSaveAgg}
        confirming={saving}
        confirmDisabled={!aggCanConfirmSave}
        showConfirm={aggCanConfirmSave || aggMismatchRows.length === 0}
      >
        {pendingAggSave ? (
          <>
            {aggShowConcurrenceTable ? (
              <ConcurrencePreviewTable
                rows={pendingAggSave.concurrenceRows}
                valueHeaders={['Reported (DHIS)', 'Validated']}
                resolutions={mismatchResolutions}
                onResolve={openResolution}
              />
            ) : null}
            <SavePreviewSections sections={pendingAggSave.sections} />
          </>
        ) : null}
      </SavePreviewModal>

      <MismatchResolutionModal
        open={!!resolutionTarget}
        fieldLabel={resolutionTarget?.label || ''}
        emrValue={resolutionTarget?.emr}
        folderValue={resolutionTarget?.folder}
        resolution={resolutionDraft}
        onChange={setResolutionDraft}
        onClose={() => setResolutionTarget(null)}
        onSave={saveResolutionDraft}
      />
    </>
  )
}
