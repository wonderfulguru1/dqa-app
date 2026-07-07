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

function aggConc(reported, validated) {
  const r = Number(reported ?? 0), v = Number(validated ?? 0)
  if (v === 0 && r === 0) return 100
  if (v === 0) return null
  return r / v * 100
}

// Per HTML's classifyPriority — applied per indicator row, rolled up to facility
function rowPriority(reported, validated) {
  const cls = aggClass(reported, validated)
  if (cls === 'Accurately reported') return 'Monitor'
  const r = Number(reported ?? 0), v = Number(validated ?? 0)
  const absVar = Math.abs(r - v)
  if (v === 0 && r > 0) return 'High'
  const conc = aggConc(r, v)
  const gap = conc != null ? Math.abs(conc - 100) : 0
  if (absVar >= 10 || gap >= 20) return 'High'
  if (absVar >= 5 || gap >= 10) return 'Medium'
  return 'Low'
}

const PRIORITY_RANK = { High: 3, Medium: 2, Low: 1, Monitor: 0 }

function facilityPriority(txAvgConc, worstAggPriority) {
  if (worstAggPriority === 'High' || (txAvgConc != null && txAvgConc < 60)) return 'High'
  if (worstAggPriority === 'Medium' || (txAvgConc != null && txAvgConc < 80)) return 'Medium'
  if (worstAggPriority === 'Low' || (txAvgConc != null && txAvgConc < 95)) return 'Low'
  return 'Monitor'
}

function suggestedAction(priority) {
  if (priority === 'High') return 'Immediate corrective action — schedule urgent DQA review and data correction'
  if (priority === 'Medium') return 'Follow-up required — schedule data quality improvement session within 30 days'
  if (priority === 'Low') return 'Minor follow-up — review discrepant indicators at next routine visit'
  return 'Continue routine monitoring — no immediate action required'
}

function priorityBadge(p) {
  const cls = p === 'High' ? 'badge-bad' : p === 'Medium' ? 'badge-warn' : p === 'Low' ? 'badge-muted' : 'badge-good'
  return <span className={`badge ${cls}`}>{p}</span>
}

function cc(v) {
  if (v == null) return undefined
  return v >= 95 ? 'var(--good)' : v >= 80 ? 'var(--warn)' : 'var(--bad)'
}

function fmtPct(v, dec = 1) {
  return v != null ? Number(v).toFixed(dec) + '%' : '—'
}

export default function CmpPage() {
  const [txRecords, setTxRecords] = useState([])
  const [aggRecords, setAggRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ period: '', state: '', lga: '' })

  useEffect(() => {
    Promise.all([
      fetch('/api/tx').then(r => r.json()),
      fetch('/api/agg').then(r => r.json()),
    ]).then(([tx, agg]) => {
      setTxRecords(Array.isArray(tx) ? tx : [])
      setAggRecords(Array.isArray(agg) ? agg : [])
      setLoading(false)
    })
  }, [])

  const allRecords = [...txRecords, ...aggRecords]
  const periods = [...new Set(allRecords.map(r => r.period).filter(Boolean))].sort()
  const states  = [...new Set(allRecords.map(r => r.state).filter(Boolean))].sort()
  const lgas    = [...new Set(allRecords.filter(r => !filters.state || r.state === filters.state).map(r => r.lga).filter(Boolean))].sort()

  function passesFilter(r) {
    return (!filters.period || r.period === filters.period) &&
           (!filters.state  || r.state  === filters.state) &&
           (!filters.lga    || r.lga    === filters.lga)
  }

  // Build per-facility CMP rows
  const facilityMap = {}
  for (const r of txRecords) {
    if (!passesFilter(r)) continue
    const k = r.facilityName || 'Unknown'
    if (!facilityMap[k]) facilityMap[k] = { facility: k, state: r.state, lga: r.lga, period: r.period, txConc: [], aggPriorities: [], aggExact: 0, aggTotal: 0, assessors: new Set() }
    if (r.concurrencePct != null) facilityMap[k].txConc.push(r.concurrencePct)
    if (r.assessor) facilityMap[k].assessors.add(r.assessor)
  }
  for (const r of aggRecords) {
    if (!passesFilter(r)) continue
    const k = r.facilityName || 'Unknown'
    if (!facilityMap[k]) facilityMap[k] = { facility: k, state: r.state, lga: r.lga, period: r.period, txConc: [], aggPriorities: [], aggExact: 0, aggTotal: 0, assessors: new Set() }
    const p = rowPriority(r.reported, r.validated)
    facilityMap[k].aggPriorities.push(p)
    facilityMap[k].aggTotal++
    if (aggClass(r.reported, r.validated) === 'Accurately reported') facilityMap[k].aggExact++
    if (r.assessor) facilityMap[k].assessors.add(r.assessor)
  }

  const cmpRows = Object.values(facilityMap).map(f => {
    const txAvg = f.txConc.length ? f.txConc.reduce((a, b) => a + b, 0) / f.txConc.length : null
    const worstAgg = f.aggPriorities.reduce((best, p) => (PRIORITY_RANK[p] ?? 0) > (PRIORITY_RANK[best] ?? 0) ? p : best, 'Monitor')
    const aggExactRate = f.aggTotal > 0 ? f.aggExact / f.aggTotal * 100 : null
    const priority = facilityPriority(txAvg, worstAgg)
    return {
      ...f,
      txAvg,
      aggExactRate,
      worstAgg,
      priority,
      action: suggestedAction(priority),
      assessors: [...f.assessors].join(', '),
    }
  }).sort((a, b) => (PRIORITY_RANK[b.priority] ?? 0) - (PRIORITY_RANK[a.priority] ?? 0) || (a.state || '').localeCompare(b.state || '') || a.facility.localeCompare(b.facility))

  const counts = { High: 0, Medium: 0, Low: 0, Monitor: 0 }
  cmpRows.forEach(r => { counts[r.priority] = (counts[r.priority] || 0) + 1 })

  function exportCSV() {
    const headers = ['Priority', 'Suggested Action', 'Facility', 'State', 'LGA', 'Period', 'Assessors', 'TX Avg Conc%', 'TX Records', 'Agg Indicators', 'Agg Exact Rate%', 'Worst Agg Priority']
    const rows = cmpRows.map(r => [
      r.priority, r.action,
      r.facility, r.state || '', r.lga || '', r.period || '', r.assessors,
      r.txAvg != null ? r.txAvg.toFixed(1) + '%' : '',
      r.txConc.length, r.aggTotal,
      r.aggExactRate != null ? r.aggExactRate.toFixed(1) + '%' : '',
      r.worstAgg,
    ])
    const csv = [headers, ...rows].map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `DQA_CMP_${filters.period || 'all'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">CMP Tracker — Continuous Monitoring Plan</h1>
        <button className="btn btn-secondary" onClick={exportCSV} disabled={cmpRows.length === 0}>Export CSV</button>
      </div>

      <div className="filter-bar">
        {[['period', 'Period', periods], ['state', 'State', states], ['lga', 'LGA', lgas]].map(([key, label, opts]) => (
          <div className="form-field" key={key}>
            <label>{label}</label>
            <select value={filters[key]} onChange={e => setFilters(f => ({ ...f, [key]: e.target.value }))}>
              <option value="">{filterAllOptionLabel(label)}</option>
              {opts.map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
        ))}
      </div>

      <div className="kpi-grid" style={{ marginBottom: '1.25rem' }}>
        <div className="kpi-card">
          <div className="kpi-label">Sites in tracker</div>
          <div className="kpi-value">{cmpRows.length}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">High priority</div>
          <div className="kpi-value" style={{ color: counts.High ? 'var(--bad)' : 'var(--good)' }}>{counts.High || 0}</div>
          <div className="kpi-sub">immediate action required</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Medium priority</div>
          <div className="kpi-value" style={{ color: counts.Medium ? 'var(--warn)' : 'var(--good)' }}>{counts.Medium || 0}</div>
          <div className="kpi-sub">follow-up within 30 days</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Low priority</div>
          <div className="kpi-value">{counts.Low || 0}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Monitor only</div>
          <div className="kpi-value" style={{ color: 'var(--good)' }}>{counts.Monitor || 0}</div>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Priority</th>
              <th>Facility</th>
              <th>State / LGA</th>
              <th>Assessors</th>
              <th style={{ textAlign: 'right' }}>TX records</th>
              <th style={{ textAlign: 'right' }}>TX avg conc%</th>
              <th style={{ textAlign: 'right' }}>Agg indicators</th>
              <th style={{ textAlign: 'right' }}>Agg exact rate%</th>
              <th>Suggested action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} style={{ textAlign: 'center', color: 'var(--muted)', padding: '1rem' }}>Loading…</td></tr>
            ) : cmpRows.length === 0 ? (
              <tr><td colSpan={10} style={{ textAlign: 'center', color: 'var(--muted)', padding: '1rem' }}>No data yet.</td></tr>
            ) : cmpRows.map((r, i) => (
                <tr key={r.facility} style={{ background: r.priority === 'High' ? '#fff5f5' : r.priority === 'Medium' ? '#fffbf0' : undefined }}>
                  <td>{i + 1}</td>
                  <td>{priorityBadge(r.priority)}</td>
                  <td style={{ fontWeight: 600, maxWidth: 180, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.facility}>{r.facility}</td>
                  <td style={{ fontSize: '0.8rem' }}>{r.state || '—'}{r.lga ? ` / ${r.lga}` : ''}</td>
                  <td style={{ fontSize: '0.75rem', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.assessors}>{r.assessors || '—'}</td>
                  <td style={{ textAlign: 'right' }}>{r.txConc.length || '—'}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: cc(r.txAvg) }}>{fmtPct(r.txAvg)}</td>
                  <td style={{ textAlign: 'right' }}>{r.aggTotal || '—'}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: cc(r.aggExactRate) }}>{fmtPct(r.aggExactRate)}</td>
                  <td style={{ fontSize: '0.8rem', maxWidth: 260 }}>{r.action}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
