'use client'
import { useState, useEffect } from 'react'

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
    ]).then(([tx, agg, iss]) => {
      setTxRecords(Array.isArray(tx) ? tx : [])
      setAggRecords(Array.isArray(agg) ? agg : [])
      setIssues(Array.isArray(iss) ? iss : [])
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
  const iss = filt(issues)

  const facilities = [...new Set(tx.map(r => r.facilityName).filter(Boolean))]
  const txConc = tx.filter(r => r.concurrencePct != null).map(r => r.concurrencePct)
  const avgTxConc = txConc.length ? Math.round(txConc.reduce((a, b) => a + b, 0) / txConc.length) : null
  const foldersFound = tx.filter(r => r.recordFound === 'Yes' || r.recordFound === 'Partial').length
  const retrieval = tx.length > 0 ? Math.round(foldersFound / tx.length * 100) : null
  const aggMatches = agg.filter(r => r.classification === 'Match').length
  const aggMatchPct = agg.length > 0 ? Math.round(aggMatches / agg.length * 100) : null
  const openIssues = iss.filter(i => i.status !== 'Resolved').length
  const today = new Date().toISOString().slice(0, 10)
  const overdueIssues = iss.filter(i => i.dueDate && i.dueDate < today && i.status !== 'Resolved').length

  const majorAgg = agg.filter(r => r.classification === 'Major Discrepancy' || r.classification === 'Over-reported')
  const byIndicator = {}
  for (const r of agg) {
    if (!byIndicator[r.indicator]) byIndicator[r.indicator] = { indicator: r.indicator, total: 0, matches: 0 }
    byIndicator[r.indicator].total++
    if (r.classification === 'Match') byIndicator[r.indicator].matches++
  }
  const indSummary = Object.values(byIndicator).sort((a, b) => a.indicator.localeCompare(b.indicator))

  function lvl(v) {
    if (v == null) return 'insufficient data for assessment'
    if (v >= 95) return 'high data quality'
    if (v >= 80) return 'moderate data quality — improvement needed'
    return 'poor data quality — urgent corrective action required'
  }

  if (loading) return <div className="alert alert-info">Loading data…</div>

  const period = filters.period || (periods.length ? periods[periods.length - 1] : 'the assessment period')
  const stateLabel = filters.state || (states.length ? states.join(', ') : 'the assessed state(s)')

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

      <div className="card" style={{ maxWidth: 900, lineHeight: 1.8 }}>
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
          For aggregate indicators, <strong>{agg.length} indicator-facility pairs</strong> were validated with an overall match rate of <strong style={{ color: aggMatchPct != null ? (aggMatchPct >= 95 ? 'var(--good)' : aggMatchPct >= 80 ? 'var(--warn)' : 'var(--bad)') : undefined }}>{aggMatchPct != null ? aggMatchPct + '%' : 'insufficient data'}</strong>.
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
          {agg.length} aggregate indicator rows were validated. {aggMatchPct != null ? `${aggMatchPct}% (${aggMatches}/${agg.length}) achieved a match.` : 'No aggregate data available.'}
          {majorAgg.length > 0 && ` ${majorAgg.length} major discrepancies or over-reported values were identified requiring follow-up.`}
        </p>
        <div className="table-wrap" style={{ marginBottom: '1rem' }}>
          <table>
            <thead>
              <tr>
                <th>Indicator</th>
                <th>Facilities Assessed</th>
                <th>Matches</th>
                <th>Match Rate</th>
              </tr>
            </thead>
            <tbody>
              {indSummary.length === 0 ? (
                <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--muted)', padding: '1rem' }}>No data yet.</td></tr>
              ) : indSummary.map(i => (
                <tr key={i.indicator}>
                  <td>{i.indicator}</td>
                  <td style={{ textAlign: 'right' }}>{i.total}</td>
                  <td style={{ textAlign: 'right' }}>{i.matches}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: i.total > 0 ? (Math.round(i.matches/i.total*100) >= 95 ? 'var(--good)' : Math.round(i.matches/i.total*100) >= 80 ? 'var(--warn)' : 'var(--bad)') : undefined }}>
                    {i.total > 0 ? Math.round(i.matches / i.total * 100) + '%' : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem' }}>4. Issues & Recommended Actions</h3>
        <p style={{ marginBottom: '0.5rem', fontSize: '0.9rem' }}>
          {iss.length} issues were documented during the assessment.
          {openIssues > 0 && ` ${openIssues} remain open.`}
          {overdueIssues > 0 && <> <strong style={{ color: 'var(--bad)' }}>{overdueIssues} issue(s) are past their due date.</strong></>}
        </p>
        <div className="table-wrap" style={{ marginBottom: '1rem' }}>
          <table>
            <thead>
              <tr>
                <th>Facility</th>
                <th>Gap</th>
                <th>Responsible</th>
                <th>Due Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {iss.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)', padding: '1rem' }}>No issues logged yet.</td></tr>
              ) : iss.slice(0, 20).map(i => (
                <tr key={i.id}>
                  <td>{i.facility || '—'}</td>
                  <td style={{ maxWidth: 250, fontSize: '0.8rem' }}>{i.gap || '—'}</td>
                  <td style={{ fontSize: '0.8rem' }}>{i.responsiblePerson || '—'}</td>
                  <td style={{ fontSize: '0.8rem' }}>{i.dueDate || '—'}</td>
                  <td><span className={`badge badge-${i.status === 'Resolved' ? 'good' : i.status === 'Escalated' ? 'bad' : 'warn'}`}>{i.status}</span></td>
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
