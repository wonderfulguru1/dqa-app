'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  normalizeTxValidationPayload,
  normalizeAggValidationPayload,
} from '@/lib/dqa-entry'
import {
  EMPTY_MISMATCH_RESOLUTION,
  isResolutionComplete,
  normalizeSingleResolution,
} from '@/lib/mismatch-resolution'
import {
  applyAggIssueResolution,
  applyTxIssueResolution,
  collectAggValidationIssues,
  collectTxValidationIssues,
  uniqueValidationFacilities,
} from '@/lib/validation-issues'
import { exportAggValidationsCsv, exportTxValidationsCsv, ISSUE_EXPORT_HEADERS, issueRowToExportRow } from '@/lib/validation-export'
import { useFieldEntry } from '../FieldEntryContext'
import SuspenseSection from '../SuspenseSection'
import FieldSectionSkeleton from '../FieldSectionSkeleton'
import MismatchResolutionModal from '../MismatchResolutionModal'

function truncate(text, max = 72) {
  const s = String(text || '').trim()
  if (!s) return '—'
  return s.length > max ? `${s.slice(0, max)}…` : s
}

export default function FieldIssuesView() {
  const {
    show, loadSaved, txSaved, aggSaved, globalState, globalFacility, defaultPeriod,
    saveEntry, upsertTxSaved, upsertAggSaved,
  } = useFieldEntry()

  const [activeTab, setActiveTab] = useState('tx')
  const [facilityFilter, setFacilityFilter] = useState('')
  const [txRecords, setTxRecords] = useState([])
  const [aggRecords, setAggRecords] = useState([])
  const [loading, setLoading] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [resolutionDraft, setResolutionDraft] = useState(EMPTY_MISMATCH_RESOLUTION)
  const [saving, setSaving] = useState(false)

  const txSavedRef = useRef(txSaved)
  txSavedRef.current = txSaved
  const aggSavedRef = useRef(aggSaved)
  aggSavedRef.current = aggSaved

  const facilityOptions = useMemo(
    () => uniqueValidationFacilities(txSaved, aggSaved, globalState),
    [txSaved, aggSaved, globalState],
  )

  useEffect(() => {
    if (globalFacility && facilityOptions.includes(globalFacility)) {
      setFacilityFilter(globalFacility)
    } else if (!facilityFilter && facilityOptions.length === 1) {
      setFacilityFilter(facilityOptions[0])
    }
  }, [globalFacility, facilityOptions, facilityFilter])

  const loadFacilityValidations = useCallback(async (facilityName) => {
    if (!facilityName) {
      setTxRecords([])
      setAggRecords([])
      return
    }

    const filterCached = (saved) => saved.filter(r =>
      r.facilityName === facilityName &&
      (!globalState || r.state === globalState) &&
      (!defaultPeriod || r.period === defaultPeriod)
    )

    const txCached = filterCached(txSavedRef.current)
    const aggCached = filterCached(aggSavedRef.current)
    setTxRecords(txCached)
    setAggRecords(aggCached)
    setLoading(!txCached.length && !aggCached.length)

    const params = new URLSearchParams({ facilityName })
    if (globalState) params.set('state', globalState)
    if (defaultPeriod) params.set('period', defaultPeriod)

    try {
      const [txRes, aggRes] = await Promise.all([
        fetch(`/api/tx?${params}`, { credentials: 'include' }),
        fetch(`/api/agg?${params}`, { credentials: 'include' }),
      ])
      const txList = txRes.ok ? await txRes.json() : []
      const aggList = aggRes.ok ? await aggRes.json() : []
      setTxRecords(Array.isArray(txList) ? txList : [])
      setAggRecords(Array.isArray(aggList) ? aggList : [])
    } catch {
      setTxRecords(txCached)
      setAggRecords(aggCached)
    } finally {
      setLoading(false)
    }
  }, [globalState, defaultPeriod])

  useEffect(() => {
    loadFacilityValidations(facilityFilter)
  }, [facilityFilter, loadFacilityValidations])

  const filters = useMemo(() => ({
    facilityName: facilityFilter,
    state: globalState || undefined,
    period: defaultPeriod || undefined,
  }), [facilityFilter, globalState, defaultPeriod])

  const txIssues = useMemo(() => collectTxValidationIssues(txRecords, filters), [txRecords, filters])
  const aggIssues = useMemo(() => collectAggValidationIssues(aggRecords, filters), [aggRecords, filters])
  const activeIssues = activeTab === 'tx' ? txIssues : aggIssues

  function openEdit(issue) {
    setEditTarget(issue)
    setResolutionDraft({ ...EMPTY_MISMATCH_RESOLUTION, ...issue.resolution })
  }

  function closeEdit() {
    if (saving) return
    setEditTarget(null)
    setResolutionDraft(EMPTY_MISMATCH_RESOLUTION)
  }

  async function saveResolution() {
    if (!editTarget) return
    if (!isResolutionComplete(resolutionDraft)) {
      show('Issues/gaps is required.', false, { useAlert: true })
      return
    }

    setSaving(true)
    try {
      if (editTarget.source === 'tx') {
        const updated = applyTxIssueResolution(editTarget.parentRecord, editTarget.fieldKey, resolutionDraft)
        const body = normalizeTxValidationPayload(updated)
        const label = `TX issue · ${editTarget.clientLabel} · ${editTarget.label}`
        const result = await saveEntry({ type: 'tx', url: '/api/tx', body, label })
        if (result.error) {
          show(result.error, false, { useAlert: true })
          return
        }
        if (result.data) upsertTxSaved(result.data)
      } else {
        const updated = applyAggIssueResolution(editTarget.parentRecord, resolutionDraft)
        const item = normalizeAggValidationPayload(updated)
        const label = `Agg issue · ${editTarget.label}`
        const result = await saveEntry({ type: 'agg', url: '/api/agg', body: [item], label })
        if (result.error) {
          show(result.error, false, { useAlert: true })
          return
        }
        if (Array.isArray(result.data) && result.data[0]) upsertAggSaved(result.data)
      }

      show('Resolution updated successfully.', true, { useAlert: true })
      await loadSaved()
      await loadFacilityValidations(facilityFilter)
      closeEdit()
    } catch {
      show('Save failed.', false, { useAlert: true })
    } finally {
      setSaving(false)
    }
  }

  function facilityExportSuffix() {
    return facilityFilter ? `_${facilityFilter.replace(/[^\w.-]+/g, '_')}` : ''
  }

  function exportFilters() {
    return {
      facilityName: facilityFilter,
      state: globalState || undefined,
      period: defaultPeriod || undefined,
    }
  }

  function exportFacilityTx() {
    if (!facilityFilter) { show('Select a facility first.', false); return }
    const ok = exportTxValidationsCsv(txRecords, `dqa_tx_validations${facilityExportSuffix()}.csv`, exportFilters())
    if (!ok) { show('No TX issues to export for this facility.', false); return }
    show('TX issues exported.', true)
  }

  function exportFacilityAgg() {
    if (!facilityFilter) { show('Select a facility first.', false); return }
    const ok = exportAggValidationsCsv(aggRecords, `dqa_aggregate_validations${facilityExportSuffix()}.csv`, exportFilters())
    if (!ok) { show('No aggregate issues to export for this facility.', false); return }
    show('Aggregate issues exported.', true)
  }

  return (
    <>
      <div className="entry-card">
        <div className="entry-section">
          <h3>Issues &amp; actions by facility</h3>
          <span className="muted">
            Issues are recorded when you resolve mismatches on TX or Aggregate entry.
            Select a facility to review and edit action plans here.
          </span>
        </div>
        <div className="grid3 mt12">
          <div className="entry-card">
            <label>Facility</label>
            <select value={facilityFilter} onChange={e => setFacilityFilter(e.target.value)}>
              <option value="">{facilityOptions.length ? 'Select facility' : 'No saved validations yet'}</option>
              {facilityOptions.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
          <div className="entry-card">
            <label>State</label>
            <input readOnly value={globalState || '—'} />
          </div>
          <div className="entry-card">
            <label>Period</label>
            <input readOnly value={defaultPeriod || '—'} />
          </div>
        </div>
        <div className="inlineActions mt12">
          <button type="button" className="entry-btn secondary" onClick={exportFacilityTx} disabled={!facilityFilter}>
            Export TX CSV (full)
          </button>
          <button type="button" className="entry-btn secondary" onClick={exportFacilityAgg} disabled={!facilityFilter}>
            Export Aggregate CSV (full)
          </button>
        </div>
      </div>

      <div className="entry-card mt12">
        <div className="entry-section issues-tab-section">
          <div className="issues-tab-copy">
            <h3>Validation issues</h3>
            <span className="muted">
              {activeTab === 'tx'
                ? 'TX mismatch resolutions and action plans for the selected facility.'
                : 'Aggregate mismatch resolutions and action plans for the selected facility.'}
            </span>
          </div>
          <div
            className="entry-segmented-control entry-segmented-control--inline"
            data-active={activeTab}
            role="tablist"
            aria-label="Issue source"
          >
            <span className="entry-segmented-indicator" aria-hidden="true" />
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'tx'}
              className={`entry-segmented-btn${activeTab === 'tx' ? ' active' : ''}`}
              onClick={() => setActiveTab('tx')}
            >
              TX validation <span className="entry-tab-count">({txIssues.length})</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'agg'}
              className={`entry-segmented-btn${activeTab === 'agg' ? ' active' : ''}`}
              onClick={() => setActiveTab('agg')}
            >
              Aggregate validation <span className="entry-tab-count">({aggIssues.length})</span>
            </button>
          </div>
        </div>

        {!facilityFilter ? (
          <p className="muted" style={{ padding: '1rem 0' }}>
            Select a facility to view issues from TX and Aggregate validation.
          </p>
        ) : (
          <SuspenseSection
            pending={loading}
            fallback={(
              <div className="save-preview-table-wrap issues-table-wrap">
                <FieldSectionSkeleton rows={6} />
              </div>
            )}
          >
          <div className="save-preview-table-wrap issues-table-wrap">
            <table className="save-preview-table issues-action-table">
              <thead>
                <tr>
                  <th>#</th>
                  {ISSUE_EXPORT_HEADERS.map(h => (
                    <th key={h}>{h}</th>
                  ))}
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {activeIssues.length === 0 ? (
                  <tr>
                    <td colSpan={ISSUE_EXPORT_HEADERS.length + 2} style={{ textAlign: 'center', color: 'var(--muted)', padding: '1rem' }}>
                      {activeTab === 'tx'
                        ? 'No TX mismatch resolutions for this facility yet. Resolve mismatches on the TX entry page when saving.'
                        : 'No aggregate mismatch resolutions for this facility yet. Resolve discrepancies on the Aggregate entry page when saving.'}
                    </td>
                  </tr>
                ) : activeIssues.map((issue, idx) => {
                  const row = issueRowToExportRow(issue)
                  return (
                    <tr key={issue.id}>
                      <td>{idx + 1}</td>
                      {ISSUE_EXPORT_HEADERS.map(h => (
                        <td key={h} title={row[h] || ''}>{truncate(row[h])}</td>
                      ))}
                      <td>
                        <button
                          type="button"
                          className="entry-btn secondary save-preview-resolve-btn"
                          onClick={() => openEdit(issue)}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          </SuspenseSection>
        )}
      </div>

      <MismatchResolutionModal
        open={!!editTarget}
        fieldLabel={editTarget?.label || ''}
        emrValue={editTarget?.emrValue}
        folderValue={editTarget?.folderValue}
        valueLabels={editTarget?.source === 'agg' ? ['Reported (DHIS)', 'Validated'] : ['EMR', 'Folder']}
        resolution={resolutionDraft}
        onChange={setResolutionDraft}
        onClose={closeEdit}
        onSave={saveResolution}
        saving={saving}
      />
    </>
  )
}
