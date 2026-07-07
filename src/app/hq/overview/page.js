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

function avg(arr) {
  const vals = arr.filter(v => v != null)
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
}

function fmtPct(v, dec = 1) {
  return v != null ? Number(v).toFixed(dec) + '%' : '—'
}

function cc(v) {
  if (v == null) return 'var(--ink)'
  return v >= 95 ? 'var(--good)' : v >= 80 ? 'var(--warn)' : 'var(--bad)'
}

export default function OverviewPage() {
  const [tx, setTx] = useState([])
  const [agg, setAgg] = useState([])
  const [issues, setIssues] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ period: '', state: '', lga: '', facilityName: '' })

  useEffect(() => {
    Promise.all([
      fetch('/api/tx').then(r => r.json()),
      fetch('/api/agg').then(r => r.json()),
      fetch('/api/issues').then(r => r.json()),
    ]).then(([t, a, i]) => {
      setTx(Array.isArray(t) ? t : [])
      setAgg(Array.isArray(a) ? a : [])
      setIssues(Array.isArray(i) ? i : [])
      setLoading(false)
    })
  }, [])

  const allRecords = [...tx, ...agg]
  const periods = [...new Set(allRecords.map(r => r.period).filter(Boolean))].sort()
  const states  = [...new Set(allRecords.map(r => r.state).filter(Boolean))].sort()
  const lgas    = [...new Set(allRecords.filter(r => !filters.state || r.state === filters.state).map(r => r.lga).filter(Boolean))].sort()

  function filt(arr) {
    return arr.filter(r =>
      (!filters.period     || r.period     === filters.period) &&
      (!filters.state      || r.state      === filters.state) &&
      (!filters.lga        || r.lga        === filters.lga) &&
      (!filters.facilityName || (r.facilityName || '').toLowerCase().includes(filters.facilityName.toLowerCase()))
    )
  }

  const filtTx  = filt(tx)
  const filtAgg = filt(agg)
  const filtIss = filt(issues.map(i => ({ ...i, facilityName: i.facility })))

  // ── Top KPIs ───────────────────────────────────────────────────────
  const txRecordCount  = filtTx.length
  const aggRowCount    = filtAgg.length
  const periodCount    = [...new Set([...filtTx, ...filtAgg].map(r => r.period).filter(Boolean))].length
  const facilityCount  = [...new Set([...filtTx, ...filtAgg].map(r => r.facilityName).filter(Boolean))].length

  // ── TX quick-view ──────────────────────────────────────────────────
  const txFound          = filtTx.filter(r => r.recordFound === 'Yes' || r.recordFound === 'Partial')
  const folderFoundRate  = filtTx.length ? txFound.length / filtTx.length * 100 : null
  const meanConcurrence  = avg(txFound.map(r => r.concurrencePct))
  const emrOnlyComp      = avg(txFound.map(r => r.emrOnlyPct))
  const exceptionCount   = filtTx.filter(r =>
    r.recordFound === 'No' ||
    (r.concurrencePct != null && r.concurrencePct < 100) ||
    r.recaptureDateValid === 'Invalid' ||
    (r.remarks && r.remarks.trim())
  ).length

  // ── Agg quick-view ─────────────────────────────────────────────────
  let exact = 0, under = 0, over = 0
  filtAgg.forEach(r => {
    const cls = aggClass(r.reported, r.validated)
    if (cls === 'Accurately reported') exact++
    else if (cls === 'Under-reported') under++
    else over++
  })
  const accurateRate = filtAgg.length ? exact / filtAgg.length * 100 : null

  // ── Issues ─────────────────────────────────────────────────────────
  const today         = new Date().toISOString().slice(0, 10)
  const openIssues    = filtIss.filter(i => i.status !== 'Resolved').length
  const overdueIssues = filtIss.filter(i => i.dueDate && i.dueDate < today && i.status !== 'Resolved').length

  if (loading) return <div className="alert alert-info">Loading overview…</div>

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">DQA Assessment Overview</h1>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        {[
          ['period',       'Period',   periods],
          ['state',        'State',    states],
          ['lga',          'LGA',      lgas],
        ].map(([key, label, opts]) => (
          <div className="form-field" key={key}>
            <label>{label}</label>
            <select value={filters[key]} onChange={e => setFilters(f => ({ ...f, [key]: e.target.value }))}>
              <option value="">{filterAllOptionLabel(label)}</option>
              {opts.map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
        ))}
        <div className="form-field">
          <label>Facility (search)</label>
          <input value={filters.facilityName} onChange={e => setFilters(f => ({ ...f, facilityName: e.target.value }))} placeholder="Filter by name…" style={{ minWidth: 160 }} />
        </div>
      </div>

      {/* Top KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.25rem' }}>
        {[
          ['TX RECORDS',           txRecordCount,  'Client rows in current filter'],
          ['AGGREGATE AUDITED ROWS', aggRowCount,  'Indicator rows in current filter'],
          ['PERIODS IN DATA',      periodCount,    'Across both DQA streams'],
          ['FACILITIES IN DATA',   facilityCount,  'Across both DQA streams'],
        ].map(([label, value, sub]) => (
          <div key={label} className="kpi-card">
            <div className="kpi-label" style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{label}</div>
            <div className="kpi-value" style={{ fontSize: '2.5rem', lineHeight: 1.1 }}>{value}</div>
            <div className="kpi-sub">{sub}</div>
          </div>
        ))}
      </div>

      {/* Quick-view panels */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>

        {/* TX_NEW quick view */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
            <div style={{ fontWeight: 700, fontSize: '1rem' }}>TX_NEW quick view</div>
            <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Current filter</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
            {[
              ['FOLDERS FOUND RATE',    fmtPct(folderFoundRate),  null],
              ['MEAN CONCURRENCE',      fmtPct(meanConcurrence),  cc(meanConcurrence)],
              ['EMR-ONLY COMPLETENESS', fmtPct(emrOnlyComp),      null],
              ['EXCEPTIONS',            String(exceptionCount),   exceptionCount > 0 ? 'var(--bad)' : 'var(--good)'],
            ].map(([label, value, color]) => (
              <div key={label}>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--muted)', marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 700, color: color || 'var(--ink)', lineHeight: 1.1 }}>{value}</div>
              </div>
            ))}
          </div>
          {filtTx.length === 0 && (
            <div style={{ marginTop: '1rem', fontSize: '0.8rem', color: 'var(--muted)' }}>No TX data for current filter.</div>
          )}
        </div>

        {/* Aggregate quick view */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
            <div style={{ fontWeight: 700, fontSize: '1rem' }}>Aggregate quick view</div>
            <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Current filter</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
            {[
              ['ACCURATE REPORTING RATE', fmtPct(accurateRate),    cc(accurateRate)],
              ['UNDER-REPORTED',          String(under),           under > 0 ? 'var(--warn)' : 'var(--good)'],
              ['OVER-REPORTED',           String(over),            over > 0 ? 'var(--bad)' : 'var(--good)'],
              ['AUDITED INDICATORS',      String(filtAgg.length),  null],
            ].map(([label, value, color]) => (
              <div key={label}>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--muted)', marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 700, color: color || 'var(--ink)', lineHeight: 1.1 }}>{value}</div>
              </div>
            ))}
          </div>
          {filtAgg.length === 0 && (
            <div style={{ marginTop: '1rem', fontSize: '0.8rem', color: 'var(--muted)' }}>No aggregate data for current filter.</div>
          )}
        </div>
      </div>

      {/* Issues + preload status */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div className="card">
          <div style={{ fontWeight: 700, fontSize: '0.9375rem', marginBottom: '1rem' }}>Issues summary</div>
          <div style={{ display: 'flex', gap: '2rem' }}>
            {[
              ['Total',    filtIss.length,  undefined],
              ['Open',     openIssues,      openIssues > 0 ? 'var(--warn)' : 'var(--good)'],
              ['Resolved', filtIss.filter(i => i.status === 'Resolved').length, 'var(--good)'],
              ['Overdue',  overdueIssues,   overdueIssues > 0 ? 'var(--bad)' : 'var(--good)'],
            ].map(([label, value, color]) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.75rem', fontWeight: 700, color: color || 'var(--ink)' }}>{value}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{label}</div>
              </div>
            ))}
          </div>
          {overdueIssues > 0 && (
            <div className="alert alert-warn" style={{ marginTop: '1rem', padding: '0.5rem 0.75rem', fontSize: '0.8rem' }}>
              {overdueIssues} issue{overdueIssues !== 1 ? 's' : ''} past due date — visit Issues tab.
            </div>
          )}
        </div>

        <div className="card">
          <div style={{ fontWeight: 700, fontSize: '0.9375rem', marginBottom: '1rem' }}>States in assessment</div>
          {states.length === 0 ? (
            <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>No data yet — field teams need to submit records.</p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {states.map(s => (
                <span key={s} className="badge badge-info" style={{ padding: '5px 12px', fontSize: '0.8rem' }}>{s}</span>
              ))}
            </div>
          )}
          {periods.length > 0 && (
            <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--muted)' }}>
              Periods: {periods.join(', ')}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
