'use client'
import { useMemo, useState, useEffect } from 'react'
import PageVoiceReader from '@/components/PageVoiceReader'
import { aggClassification } from '@/lib/dqa-entry'
import { buildBriefNarrative } from '@/lib/brief-narrative'
import {
  collectAllValidationIssues,
  isHqIssueResolved,
  manualIssueToHqRow,
  validationIssueToHqRow,
} from '@/lib/validation-issues'

function dueFlag(dueDate, status) {
  if (isHqIssueResolved(status)) return 'Completed'
  if (!dueDate) return 'Pending'
  const diff = (new Date(dueDate) - new Date()) / 86400000
  if (diff < 0) return 'Overdue'
  if (diff <= 7) return 'Due soon'
  return 'On track'
}

function dueFlagBadge(flag) {
  const map = { Completed: 'badge-good', Overdue: 'badge-bad', 'Due soon': 'badge-warn', 'On track': 'badge-muted', Pending: 'badge-muted' }
  return <span className={`badge ${map[flag] || 'badge-muted'}`}>{flag}</span>
}

function statusBadge(s) {
  const map = {
    Pending: 'badge-warn',
    Ongoing: 'badge-info',
    Completed: 'badge-good',
    'In Progress': 'badge-info',
    Resolved: 'badge-good',
    Escalated: 'badge-bad',
  }
  return <span className={`badge ${map[s] || 'badge-muted'}`}>{s}</span>
}

export default function BriefPage() {
  const [txRecords, setTxRecords] = useState([])
  const [aggRecords, setAggRecords] = useState([])
  const [issues, setIssues] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ period: '', state: '' })

  useEffect(() => {
    Promise.all([
      fetch('/api/tx').then(r => r.json()),
      fetch('/api/agg').then(r => r.json()),
      fetch('/api/issues').then(r => r.json()),
    ]).then(([tx, agg, manual]) => {
      const txList = Array.isArray(tx) ? tx : []
      const aggList = Array.isArray(agg) ? agg : []
      const manualList = Array.isArray(manual) ? manual : []
      const validationRows = collectAllValidationIssues(txList, aggList).map(validationIssueToHqRow)
      const manualRows = manualList.map(manualIssueToHqRow)
      setTxRecords(txList)
      setAggRecords(aggList)
      setIssues([...validationRows, ...manualRows])
      setLoading(false)
    })
  }, [])

  const periods = [...new Set([...txRecords, ...aggRecords].map(r => r.period).filter(Boolean))].sort()
  const states = [...new Set([...txRecords, ...aggRecords].map(r => r.state).filter(Boolean))].sort()

  function filt(arr) {
    return arr.filter(r =>
      (!filters.period || r.period === filters.period) &&
      (!filters.state || r.state === filters.state)
    )
  }

  const tx = filt(txRecords)
  const agg = filt(aggRecords)
  const filteredIssues = issues.filter(i =>
    (!filters.period || i.period === filters.period) &&
    (!filters.state || i.state === filters.state)
  )
  const annotatedIssues = filteredIssues.map(i => ({ ...i, _flag: dueFlag(i.dueDate, i.status) }))

  const facilities = [...new Set(tx.map(r => r.facilityName).filter(Boolean))]
  const txConc = tx.filter(r => r.concurrencePct != null).map(r => r.concurrencePct)
  const avgTxConc = txConc.length ? Math.round(txConc.reduce((a, b) => a + b, 0) / txConc.length) : null
  const foldersFound = tx.filter(r => r.recordFound === 'Yes' || r.recordFound === 'Partial').length
  const retrieval = tx.length > 0 ? Math.round(foldersFound / tx.length * 100) : null
  const aggAccurate = agg.filter(r => aggClassification(r.reported, r.validated) === 'Accurately reported').length
  const aggAccurateRate = agg.length > 0 ? Math.round(aggAccurate / agg.length * 100) : null
  const openIssues = annotatedIssues.filter(i => !isHqIssueResolved(i.status)).length
  const today = new Date().toISOString().slice(0, 10)
  const overdueIssues = annotatedIssues.filter(i => i._flag === 'Overdue').length

  const discrepancyAgg = agg.filter(r => aggClassification(r.reported, r.validated) !== 'Accurately reported')
  const byIndicator = {}
  for (const r of agg) {
    if (!byIndicator[r.indicator]) byIndicator[r.indicator] = { indicator: r.indicator, total: 0, accurate: 0 }
    byIndicator[r.indicator].total++
    if (aggClassification(r.reported, r.validated) === 'Accurately reported') byIndicator[r.indicator].accurate++
  }
  const indSummary = Object.values(byIndicator).sort((a, b) => a.indicator.localeCompare(b.indicator))

  function lvl(v) {
    if (v == null) return 'insufficient data for assessment'
    if (v >= 95) return 'high data quality'
    if (v >= 80) return 'moderate data quality — improvement needed'
    return 'poor data quality — urgent corrective action required'
  }

  const period = filters.period || (periods.length ? periods[periods.length - 1] : 'the assessment period')
  const stateLabel = filters.state || (states.length ? states.join(', ') : 'the assessed state(s)')

  const narrativeText = useMemo(() => buildBriefNarrative({
    stateLabel,
    period,
    today,
    facilitiesCount: facilities.length,
    txCount: tx.length,
    retrieval,
    avgTxConc,
    qualityLevel: lvl(avgTxConc),
    aggCount: agg.length,
    aggAccurateRate,
    aggAccurate,
    foldersFound,
    indSummary,
    annotatedIssues,
    openIssues,
    overdueIssues,
    discrepancyCount: discrepancyAgg.length,
  }), [
    stateLabel, period, today, facilities.length, tx.length, retrieval, avgTxConc,
    agg.length, aggAccurateRate, aggAccurate, foldersFound, indSummary, annotatedIssues,
    openIssues, overdueIssues, discrepancyAgg.length,
  ])

  if (loading) return <div className="alert alert-info">Loading data…</div>

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">State Out-Brief Narrative</h1>
        <button className="btn btn-secondary" onClick={() => window.print()}>Print / PDF</button>
      </div>

      <div className="filter-bar">
        <div className="form-field">
          <label>Period</label>
          <select value={filters.period} onChange={e => setFilters(f => ({ ...f, period: e.target.value }))}>
            <option value="">All periods</option>
            {periods.map(p => <option key={p}>{p}</option>)}
          </select>
        </div>
        <div className="form-field">
          <label>State</label>
          <select value={filters.state} onChange={e => setFilters(f => ({ ...f, state: e.target.value }))}>
            <option value="">All states</option>
            {states.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <PageVoiceReader
        text={narrativeText}
        title="Listen to this out-brief"
      />

      <div className="card" style={{ width: '100%', lineHeight: 1.8 }}>
        <div style={{ borderBottom: '2px solid var(--g1)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>ECEWS Data Quality Assessment</div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: 4 }}>State Out-Brief: {stateLabel}</h2>
          <div style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>Period: {period} &nbsp;·&nbsp; Generated: {today}</div>
        </div>

        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem' }}>1. Executive Summary</h3>
        <p style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>
          The ECEWS DQA team conducted a data quality assessment across <strong>{facilities.length} facilit{facilities.length === 1 ? 'y' : 'ies'}</strong> in {stateLabel} for the {period} reporting period.
          A total of <strong>{tx.length} client-level records</strong> were reviewed for TX_NEW, with a folder retrieval rate of <strong>{retrieval != null ? retrieval + '%' : 'N/A'}</strong>.
          The overall client-level concurrence was <strong style={{ color: avgTxConc != null ? (avgTxConc >= 95 ? 'var(--good)' : avgTxConc >= 80 ? 'var(--warn)' : 'var(--bad)') : undefined }}>{avgTxConc != null ? avgTxConc + '%' : 'insufficient data'}</strong>,
          indicating <em>{lvl(avgTxConc)}</em>.
          For aggregate indicators, <strong>{agg.length} indicator-facility pairs</strong> were validated with an overall accurate reporting rate of <strong style={{ color: aggAccurateRate != null ? (aggAccurateRate >= 95 ? 'var(--good)' : aggAccurateRate >= 80 ? 'var(--warn)' : 'var(--bad)') : undefined }}>{aggAccurateRate != null ? aggAccurateRate + '%' : 'insufficient data'}</strong>.
        </p>

        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem' }}>2. TX_NEW Client-Level Findings</h3>
        <p style={{ marginBottom: '0.5rem', fontSize: '0.9rem' }}>The following cascade summarizes the TX_NEW review:</p>
        <ul style={{ marginLeft: '1.5rem', marginBottom: '1rem', fontSize: '0.9rem' }}>
          <li>Clients sampled: <strong>{tx.length}</strong></li>
          <li>Folders retrieved: <strong>{foldersFound}</strong> ({retrieval != null ? retrieval + '%' : 'N/A'} retrieval rate)</li>
          <li>Average concurrence: <strong>{avgTxConc != null ? avgTxConc + '%' : 'N/A'}</strong></li>
          <li>Facilities visited: <strong>{facilities.length}</strong></li>
        </ul>

        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem' }}>3. Aggregate Indicator Concurrence</h3>
        <p style={{ marginBottom: '0.5rem', fontSize: '0.9rem' }}>
          {agg.length} aggregate indicator rows were validated. {aggAccurateRate != null ? `${aggAccurateRate}% (${aggAccurate}/${agg.length}) were accurately reported.` : 'No aggregate data available.'}
          {discrepancyAgg.length > 0 && ` ${discrepancyAgg.length} under-reported or over-reported values were identified requiring follow-up.`}
        </p>
        <div className="table-wrap" style={{ marginBottom: '1rem' }}>
          <table>
            <thead>
              <tr>
                <th>Indicator</th>
                <th>Facilities Assessed</th>
                <th>Accurately reported</th>
                <th>Accurate reporting rate</th>
              </tr>
            </thead>
            <tbody>
              {indSummary.length === 0 ? (
                <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--muted)', padding: '1rem' }}>No data yet.</td></tr>
              ) : indSummary.map(i => (
                <tr key={i.indicator}>
                  <td>{i.indicator}</td>
                  <td style={{ textAlign: 'right' }}>{i.total}</td>
                  <td style={{ textAlign: 'right' }}>{i.accurate}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: i.total > 0 ? (Math.round(i.accurate/i.total*100) >= 95 ? 'var(--good)' : Math.round(i.accurate/i.total*100) >= 80 ? 'var(--warn)' : 'var(--bad)') : undefined }}>
                    {i.total > 0 ? Math.round(i.accurate / i.total * 100) + '%' : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem' }}>4. Issues & Recommended Actions</h3>
        <p style={{ marginBottom: '0.5rem', fontSize: '0.9rem' }}>
          {annotatedIssues.length} issues were documented during the assessment.
          {openIssues > 0 && ` ${openIssues} remain open.`}
          {overdueIssues > 0 && <> <strong style={{ color: 'var(--bad)' }}>{overdueIssues} issue(s) are past their due date.</strong></>}
        </p>
        <div className="table-wrap" style={{ marginBottom: '1rem' }}>
          <table>
            <thead>
              <tr>
                <th>#</th><th>Date</th><th>Facility</th><th>State</th>
                <th>Thematic area</th><th>Gap</th>
                <th>Assessor</th><th>Responsible person</th><th>Due date</th><th>Flag</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {annotatedIssues.length === 0 ? (
                <tr><td colSpan={12} style={{ textAlign: 'center', color: 'var(--muted)', padding: '1rem' }}>No mismatch resolutions or issues logged yet.</td></tr>
              ) : annotatedIssues.map((issue, idx) => (
                <tr key={issue.id} style={{ background: issue._flag === 'Overdue' ? '#fff8f8' : undefined }}>
                  <td>{idx + 1}</td>
                  <td style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{issue.date || '—'}</td>
                  <td style={{ fontWeight: 600, fontSize: '0.85rem' }}>{issue.facility || '—'}</td>
                  <td>{issue.state || '—'}</td>
                  <td><span className="badge badge-info">{issue.thematicArea || '—'}</span></td>
                  <td style={{ maxWidth: 220 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.8rem' }} title={issue.gap}>{issue.gap || '—'}</div>
                    {issue.proposedSolution && (
                      <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }} title={issue.proposedSolution}>
                        ↳ {issue.proposedSolution.slice(0, 60)}{issue.proposedSolution.length > 60 ? '…' : ''}
                      </div>
                    )}
                  </td>
                  <td style={{ fontSize: '0.8rem' }}>{issue.assessor || '—'}</td>
                  <td style={{ fontSize: '0.8rem' }}>{issue.responsiblePerson || '—'}</td>
                  <td style={{ whiteSpace: 'nowrap', fontSize: '0.75rem' }}>{issue.dueDate || '—'}</td>
                  <td>{dueFlagBadge(issue._flag)}</td>
                  <td>{statusBadge(issue.status)}</td>
                  <td>
                    {issue.source === 'manual' ? (
                      <span className="badge badge-muted">Manual</span>
                    ) : (
                      <span className="badge badge-muted" title="From validation resolution">Validation</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem' }}>5. Conclusion</h3>
        <p style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>
          This out-brief was generated by the ECEWS DQA Companion system on {today}.
          Data reflects assessments conducted for {period} in {stateLabel}.
          For detailed facility-level analysis, refer to the TX_NEW Client-Level and Aggregate Concurrence tabs.
        </p>
      </div>
    </>
  )
}
