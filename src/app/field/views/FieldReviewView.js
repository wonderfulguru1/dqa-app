'use client'
import { useMemo, useState } from 'react'
import {
  buildAggReportRows,
  exportAggReportCsv,
  AGG_REPORT_HEADERS,
} from '@/lib/agg-report-export'
import {
  buildTxNewReportRows,
  exportTxNewReportCsv,
  TX_NEW_REPORT_HEADERS,
} from '@/lib/tx-new-report-export'
import { useFieldEntry } from '../FieldEntryContext'
import SuspenseSection from '../SuspenseSection'
import FieldSectionSkeleton from '../FieldSectionSkeleton'

export default function FieldReviewView() {
  const {
    show, txSaved, aggSaved, issuesSaved, pendingEntries, pendingCount, savedLoading,
    preloadTx, globalState, globalFacility, defaultPeriod,
  } = useFieldEntry()

  const [exporting, setExporting] = useState(null)
  const [activeReportTab, setActiveReportTab] = useState('agg')

  const exportFilters = useMemo(() => ({
    facilityName: globalFacility || undefined,
    state: globalState || undefined,
    period: defaultPeriod || undefined,
  }), [globalFacility, globalState, defaultPeriod])

  const aggReportRows = useMemo(
    () => buildAggReportRows(aggSaved, exportFilters),
    [aggSaved, exportFilters],
  )

  const txReportOptions = useMemo(() => ({ preloadTx }), [preloadTx])

  const txNewReportRows = useMemo(
    () => buildTxNewReportRows(txSaved, exportFilters, txReportOptions),
    [txSaved, exportFilters, txReportOptions],
  )

  async function fetchTxForExport() {
    const params = new URLSearchParams()
    if (globalState) params.set('state', globalState)
    if (globalFacility) params.set('facilityName', globalFacility)
    if (defaultPeriod) params.set('period', defaultPeriod)
    const qs = params.toString()
    const res = await fetch(`/api/tx${qs ? `?${qs}` : ''}`, { credentials: 'include' })
    if (!res.ok) throw new Error('Failed to load TX validations')
    const data = await res.json()
    return Array.isArray(data) ? data : []
  }

  async function fetchAggForExport() {
    const params = new URLSearchParams()
    if (globalState) params.set('state', globalState)
    if (globalFacility) params.set('facilityName', globalFacility)
    if (defaultPeriod) params.set('period', defaultPeriod)
    const qs = params.toString()
    const res = await fetch(`/api/agg${qs ? `?${qs}` : ''}`, { credentials: 'include' })
    if (!res.ok) throw new Error('Failed to load aggregate validations')
    const data = await res.json()
    return Array.isArray(data) ? data : []
  }

  async function handleExportAggReport() {
    setExporting('agg-report')
    try {
      let records = aggSaved
      try {
        const fresh = await fetchAggForExport()
        if (fresh.length) records = fresh
      } catch {
        // export from context data
      }
      const suffix = globalFacility ? `_${globalFacility.replace(/[^\w.-]+/g, '_')}` : ''
      const ok = exportAggReportCsv(records, `Aggregate_Report${suffix}.csv`, exportFilters)
      if (!ok) {
        show('No aggregate report rows to export.', false)
        return
      }
      show('Aggregate report exported.', true)
    } catch {
      show('Aggregate report export failed.', false, { useAlert: true })
    } finally {
      setExporting(null)
    }
  }

  async function handleExportTxNewReport() {
    setExporting('tx-new-report')
    try {
      let records = txSaved
      try {
        const fresh = await fetchTxForExport()
        if (fresh.length) records = fresh
      } catch {
        // export from context data
      }
      const suffix = globalFacility ? `_${globalFacility.replace(/[^\w.-]+/g, '_')}` : ''
      const ok = exportTxNewReportCsv(records, `TX_NEW_Report${suffix}.csv`, exportFilters, txReportOptions)
      if (!ok) {
        show('No TX_NEW report rows to export.', false)
        return
      }
      show('TX_NEW report exported.', true)
    } catch {
      show('TX_NEW report export failed.', false, { useAlert: true })
    } finally {
      setExporting(null)
    }
  }

  const reportLoading = savedLoading && !aggSaved.length && !txSaved.length

  return (
    <>
      <div className="grid4">
        <div className="entry-card entry-kpi"><div className="k">TX validations</div><div className="v">{txSaved.length}</div><div className="s">Synced to server</div></div>
        <div className="entry-card entry-kpi"><div className="k">Aggregate validations</div><div className="v">{aggSaved.length}</div><div className="s">Synced indicator rows</div></div>
        <div className="entry-card entry-kpi"><div className="k">Issues</div><div className="v">{issuesSaved.length}</div><div className="s">Synced issue rows</div></div>
        <div className="entry-card entry-kpi"><div className="k">Pending on device</div><div className="v">{pendingCount}</div><div className="s">Waiting to sync when online</div></div>
      </div>

      <div className="entry-card mt12">
        <div className="entry-section">
          <h3>Reports</h3>
          <span className="muted">
            {activeReportTab === 'agg'
              ? 'Aggregate report: one row per facility. State, LGA, then Period, then (Reported), (Validated), and (Result) per indicator.'
              : 'TX_NEW report: one row per client. State, LGA, then Period, then Folder | EMR | Result triplets, then metrics.'}
            {globalFacility ? ` Filtered to facility: ${globalFacility}.` : ''}
          </span>
        </div>

        <div
          className="entry-segmented-control mt12"
          data-active={activeReportTab}
          role="tablist"
          aria-label="Report type"
        >
          <span className="entry-segmented-indicator" aria-hidden="true" />
          <button
            type="button"
            role="tab"
            aria-selected={activeReportTab === 'agg'}
            className={`entry-segmented-btn${activeReportTab === 'agg' ? ' active' : ''}`}
            onClick={() => setActiveReportTab('agg')}
          >
            Aggregate Report <span className="entry-tab-count">({aggReportRows.length})</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeReportTab === 'tx-new'}
            className={`entry-segmented-btn${activeReportTab === 'tx-new' ? ' active' : ''}`}
            onClick={() => setActiveReportTab('tx-new')}
          >
            TX_NEW Report <span className="entry-tab-count">({txNewReportRows.length})</span>
          </button>
        </div>

        <div className="inlineActions mt12">
          {activeReportTab === 'agg' ? (
            <button
              type="button"
              className="entry-btn"
              onClick={handleExportAggReport}
              disabled={exporting === 'agg-report'}
            >
              {exporting === 'agg-report' ? 'Exporting aggregate report…' : 'Export Aggregate Report CSV'}
            </button>
          ) : (
            <button
              type="button"
              className="entry-btn"
              onClick={handleExportTxNewReport}
              disabled={exporting === 'tx-new-report'}
            >
              {exporting === 'tx-new-report' ? 'Exporting TX_NEW report…' : 'Export TX_NEW Report CSV'}
            </button>
          )}
        </div>

        <SuspenseSection
          pending={reportLoading}
          fallback={(
            <div className="save-preview-table-wrap issues-table-wrap mt12">
              <FieldSectionSkeleton rows={6} />
            </div>
          )}
        >
        <div className="save-preview-table-wrap issues-table-wrap mt12">
          {activeReportTab === 'agg' ? (
            <table className="save-preview-table issues-action-table">
              <thead>
                <tr>
                  {AGG_REPORT_HEADERS.map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {aggReportRows.length === 0 ? (
                  <tr>
                    <td colSpan={AGG_REPORT_HEADERS.length} style={{ textAlign: 'center', color: 'var(--muted)', padding: '1rem' }}>
                      No aggregate validation data for report yet.
                    </td>
                  </tr>
                ) : aggReportRows.map((row, idx) => (
                  <tr key={`${row.FacilityName}-${row.Period}-${idx}`}>
                    {AGG_REPORT_HEADERS.map(h => (
                      <td key={h}>{row[h] || '—'}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="save-preview-table issues-action-table">
              <thead>
                <tr>
                  {TX_NEW_REPORT_HEADERS.map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {txNewReportRows.length === 0 ? (
                  <tr>
                    <td colSpan={TX_NEW_REPORT_HEADERS.length} style={{ textAlign: 'center', color: 'var(--muted)', padding: '1rem' }}>
                      No TX_NEW validation data for report yet.
                    </td>
                  </tr>
                ) : txNewReportRows.map((row, idx) => (
                  <tr key={`tx-new-${row.PepID}-${row.patient_id}-${idx}`}>
                    {TX_NEW_REPORT_HEADERS.map(h => (
                      <td key={h}>{row[h] || '—'}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        </SuspenseSection>
      </div>

      {pendingEntries.length > 0 && (
        <div className="entry-card mt12">
          <div className="entry-section"><h3>Pending on this device</h3><span className="muted">Syncs automatically when online</span></div>
          <div className="tableWrap">
            <table>
              <thead><tr><th>Saved at</th><th>Type</th><th>Summary</th></tr></thead>
              <tbody>
                {pendingEntries.map(item => (
                  <tr key={item.id} className="entry-pending-row">
                    <td>{new Date(item.createdAt).toLocaleString()}</td>
                    <td>{item.type}</td>
                    <td>{item.label}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}
