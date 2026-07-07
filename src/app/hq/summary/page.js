'use client'
import { useState, useEffect } from 'react'
import { filterAllOptionLabel } from '@/lib/hq-filters'

function aggClass(reported, validated) {
  const r = Number(reported ?? 0), v = Number(validated ?? 0)
  if (v === 0 && r === 0) return 'Accurately reported'
  if (v === 0 && r > 0) return 'Over-reported'
  const c = r / v * 100
  if (Math.abs(c - 100) < 0.01) return 'Accurately reported'
  return c > 100 ? 'Over-reported' : 'Under-reported'
}

function rowPriority(reported, validated) {
  const cls = aggClass(reported, validated)
  if (cls === 'Accurately reported') return 'Monitor'
  const r = Number(reported ?? 0), v = Number(validated ?? 0)
  const absVar = Math.abs(r - v)
  if (v === 0 && r > 0) return 'High'
  const conc = v > 0 ? r / v * 100 : null
  const gap = conc != null ? Math.abs(conc - 100) : 0
  if (absVar >= 10 || gap >= 20) return 'High'
  if (absVar >= 5 || gap >= 10) return 'Medium'
  return 'Low'
}

function avg(arr) {
  const vals = arr.filter(v => v != null)
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
}

function fmtPct(v, dec = 1) {
  return v != null ? Number(v).toFixed(dec) + '%' : '—'
}

function cc(v) {
  if (v == null) return undefined
  return v >= 95 ? 'var(--good)' : v >= 80 ? 'var(--warn)' : 'var(--bad)'
}

export default function HqSummaryPage() {
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
  const states  = [...new Set([...txRecords, ...aggRecords].map(r => r.state).filter(Boolean))].sort()

  function filt(arr) {
    return arr.filter(r =>
      (!filters.period || r.period === filters.period) &&
      (!filters.state  || r.state  === filters.state)
    )
  }

  const tx  = filt(txRecords)
  const agg = filt(aggRecords)
  const iss = filt(issues)

  const today = new Date().toISOString().slice(0, 10)

  // Build per-facility composite summary
  const facilityMap = {}
  const touch = (k, state) => {
    if (!facilityMap[k]) facilityMap[k] = { facility: k, state, txConc: [], txTotal: 0, txFound: 0, aggConc: [], aggHighPriority: 0, aggOver: 0, aggTotal: 0, issueCount: 0, openIssues: 0, overdueIssues: 0 }
  }

  for (const r of tx) {
    touch(r.facilityName, r.state)
    facilityMap[r.facilityName].txTotal++
    if (r.recordFound === 'Yes' || r.recordFound === 'Partial') facilityMap[r.facilityName].txFound++
    if (r.concurrencePct != null) facilityMap[r.facilityName].txConc.push(r.concurrencePct)
  }

  for (const r of agg) {
    touch(r.facilityName, r.state)
    const f = facilityMap[r.facilityName]
    f.aggTotal++
    const cls = aggClass(r.reported, r.validated)
    if (cls === 'Over-reported') f.aggOver++
    const p = rowPriority(r.reported, r.validated)
    if (p === 'High') f.aggHighPriority++
    const conc = r.validated > 0 ? r.reported / r.validated * 100 : null
    if (conc != null) f.aggConc.push(conc)
  }

  for (const i of iss) {
    const k = i.facility
    if (!k) continue
    touch(k, i.state)
    facilityMap[k].issueCount++
    if (i.status !== 'Resolved') facilityMap[k].openIssues++
    if (i.dueDate && i.dueDate < today && i.status !== 'Resolved') facilityMap[k].overdueIssues++
  }

  const summary = Object.values(facilityMap).map(f => {
    const txAvg  = avg(f.txConc)
    const aggAvg = avg(f.aggConc)
    const aggExactRate = f.aggTotal > 0
      ? agg.filter(r => r.facilityName === f.facility && aggClass(r.reported, r.validated) === 'Accurately reported').length / f.aggTotal * 100
      : null

    // Watchlist: TX conc < 80%, any High agg priority, overdue issues, or >2 over-reported
    const watchlist =
      (txAvg != null && txAvg < 80) ||
      f.aggHighPriority > 0 ||
      f.overdueIssues > 0 ||
      f.aggOver > 2

    // Overall site priority
    let sitePriority = 'Monitor'
    if ((txAvg != null && txAvg < 60) || f.aggHighPriority > 2 || f.overdueIssues > 1) sitePriority = 'High'
    else if ((txAvg != null && txAvg < 80) || f.aggHighPriority > 0 || f.overdueIssues > 0) sitePriority = 'Medium'
    else if ((txAvg != null && txAvg < 95) || (aggExactRate != null && aggExactRate < 80)) sitePriority = 'Low'

    return { ...f, txAvg, aggAvg, aggExactRate, watchlist, sitePriority }
  }).sort((a, b) => {
    if (a.watchlist !== b.watchlist) return a.watchlist ? -1 : 1
    const rank = { High: 3, Medium: 2, Low: 1, Monitor: 0 }
    return (rank[b.sitePriority] ?? 0) - (rank[a.sitePriority] ?? 0) || (a.txAvg ?? 101) - (b.txAvg ?? 101)
  })

  const watchlistCount = summary.filter(f => f.watchlist).length
  const totalSites     = summary.length
  const txSites        = summary.filter(f => f.txTotal > 0).length
  const aggSites       = summary.filter(f => f.aggTotal > 0).length

  function priorityBadge(p) {
    const cls = p === 'High' ? 'badge-bad' : p === 'Medium' ? 'badge-warn' : p === 'Low' ? 'badge-muted' : 'badge-good'
    return <span className={`badge ${cls}`}>{p}</span>
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">HQ Summary — Site Watchlist</h1>
      </div>

      <div className="filter-bar">
        {[['period', 'Period', periods], ['state', 'State', states]].map(([key, label, opts]) => (
          <div className="form-field" key={key}>
            <label>{label}</label>
            <select value={filters[key]} onChange={e => setFilters(f => ({ ...f, [key]: e.target.value }))}>
              <option value="">{filterAllOptionLabel(label)}</option>
              {opts.map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
        ))}
      </div>

      {loading && <div className="alert alert-info" style={{ marginBottom: '1rem' }}>Loading…</div>}

      {watchlistCount > 0 && (
        <div className="alert alert-warn" style={{ marginBottom: '1.25rem' }}>
          <strong>{watchlistCount} of {totalSites} site{totalSites !== 1 ? 's' : ''} flagged for follow-up</strong>
          &nbsp;— TX concurrence &lt;80%, high-priority agg discrepancies, over-reported indicators, or overdue issues.
        </div>
      )}

      {/* KPIs */}
      <div className="kpi-grid" style={{ marginBottom: '1.25rem' }}>
        <div className="kpi-card"><div className="kpi-label">Total sites</div><div className="kpi-value">{totalSites}</div></div>
        <div className="kpi-card"><div className="kpi-label">Watchlist</div><div className="kpi-value" style={{ color: watchlistCount ? 'var(--bad)' : 'var(--good)' }}>{watchlistCount}</div></div>
        <div className="kpi-card"><div className="kpi-label">Sites with TX data</div><div className="kpi-value">{txSites}</div></div>
        <div className="kpi-card"><div className="kpi-label">Sites with Agg data</div><div className="kpi-value">{aggSites}</div></div>
        <div className="kpi-card">
          <div className="kpi-label">Total TX records</div>
          <div className="kpi-value">{tx.length}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Total Agg rows</div>
          <div className="kpi-value">{agg.length}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Open issues</div>
          <div className="kpi-value" style={{ color: iss.filter(i => i.status !== 'Resolved').length > 0 ? 'var(--warn)' : 'var(--good)' }}>
            {iss.filter(i => i.status !== 'Resolved').length}
          </div>
        </div>
      </div>

      {/* Main summary table */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Watchlist</th>
              <th>Priority</th>
              <th>Facility</th>
              <th>State</th>
              <th style={{ textAlign: 'right' }}>TX records</th>
              <th style={{ textAlign: 'right' }}>TX avg conc%</th>
              <th style={{ textAlign: 'right' }}>Agg indicators</th>
              <th style={{ textAlign: 'right' }}>Agg exact rate%</th>
              <th style={{ textAlign: 'right' }}>High-pri agg</th>
              <th style={{ textAlign: 'right' }}>Open issues</th>
              <th style={{ textAlign: 'right' }}>Overdue</th>
            </tr>
          </thead>
          <tbody>
            {summary.length === 0 ? (
              <tr><td colSpan={12} style={{ textAlign: 'center', color: 'var(--muted)', padding: '1rem' }}>No data yet.</td></tr>
            ) : summary.map((f, i) => (
                  <tr key={f.facility} style={{ background: f.watchlist ? '#fff9f0' : undefined }}>
                    <td>{i + 1}</td>
                    <td>
                      {f.watchlist
                        ? <span className="badge badge-bad">Watch</span>
                        : <span className="badge badge-good">OK</span>}
                    </td>
                    <td>{priorityBadge(f.sitePriority)}</td>
                    <td style={{ fontWeight: 600, maxWidth: 180, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={f.facility}>{f.facility}</td>
                    <td>{f.state || '—'}</td>
                    <td style={{ textAlign: 'right' }}>{f.txTotal || '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: cc(f.txAvg) }}>{fmtPct(f.txAvg)}</td>
                    <td style={{ textAlign: 'right' }}>{f.aggTotal || '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: cc(f.aggExactRate) }}>{fmtPct(f.aggExactRate)}</td>
                    <td style={{ textAlign: 'right', color: f.aggHighPriority > 0 ? 'var(--bad)' : undefined, fontWeight: f.aggHighPriority > 0 ? 700 : undefined }}>
                      {f.aggHighPriority > 0 ? f.aggHighPriority : '—'}
                    </td>
                    <td style={{ textAlign: 'right', color: f.openIssues > 0 ? 'var(--warn)' : undefined }}>
                      {f.openIssues > 0 ? f.openIssues : '—'}
                    </td>
                    <td style={{ textAlign: 'right', color: f.overdueIssues > 0 ? 'var(--bad)' : undefined, fontWeight: f.overdueIssues > 0 ? 700 : undefined }}>
                      {f.overdueIssues > 0 ? f.overdueIssues : '—'}
                    </td>
                  </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
