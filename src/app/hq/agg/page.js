'use client'
import { useState, useEffect, useRef } from 'react'
import { Chart, registerables } from 'chart.js'
import { aggClassificationColor } from '@/lib/dqa-entry'
import { filterAllOptionLabel } from '@/lib/hq-filters'

Chart.register(...registerables)

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
  const vals = arr.filter(v => v != null && !isNaN(v))
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
}

function fmtPct(v, dec = 1) {
  return v != null ? Number(v).toFixed(dec) + '%' : '0%'
}

function fmtNum(v) {
  return v != null ? Number(v).toLocaleString() : '0'
}

function cc(v) {
  if (v == null) return '#94a3b8'
  return v >= 95 ? '#16a34a' : v >= 80 ? '#d97706' : '#dc2626'
}

function useChart(ref, cfg) {
  const inst = useRef(null)
  useEffect(() => {
    if (!ref.current) return
    if (inst.current) { inst.current.destroy(); inst.current = null }
    if (!cfg) return
    inst.current = new Chart(ref.current, cfg)
    return () => { if (inst.current) { inst.current.destroy(); inst.current = null } }
  }, [cfg])
}

export default function HqAggPage() {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ period: '', state: '', lga: '', facilityName: '', indicator: '' })
  const [trendIndicator, setTrendIndicator] = useState('')

  const facChartRef  = useRef(null)
  const trendRef     = useRef(null)

  useEffect(() => {
    fetch('/api/agg').then(r => r.json()).then(data => {
      setRecords(Array.isArray(data) ? data : [])
      setLoading(false)
    })
  }, [])

  const periods    = [...new Set(records.map(r => r.period).filter(Boolean))].sort()
  const states     = [...new Set(records.map(r => r.state).filter(Boolean))].sort()
  const lgas       = [...new Set(records.filter(r => !filters.state || r.state === filters.state).map(r => r.lga).filter(Boolean))].sort()
  const indicators = [...new Set(records.map(r => r.indicator).filter(Boolean))].sort()

  const filtered = records.filter(r =>
    (!filters.period     || r.period    === filters.period) &&
    (!filters.state      || r.state     === filters.state) &&
    (!filters.lga        || r.lga       === filters.lga) &&
    (!filters.facilityName || (r.facilityName || '').toLowerCase().includes(filters.facilityName.toLowerCase())) &&
    (!filters.indicator  || r.indicator === filters.indicator)
  )

  // ── KPI row 1 ──────────────────────────────────────────────────────
  let exact = 0, under = 0, over = 0
  filtered.forEach(r => {
    const c = aggClass(r.reported, r.validated)
    if (c === 'Accurately reported') exact++
    else if (c === 'Under-reported') under++
    else over++
  })

  // ── KPI row 2 ──────────────────────────────────────────────────────
  const totalReported  = filtered.reduce((s, r) => s + Number(r.reported  ?? 0), 0)
  const totalValidated = filtered.reduce((s, r) => s + Number(r.validated ?? 0), 0)
  const weightedConc   = totalValidated > 0 ? totalReported / totalValidated * 100 : null

  // ── Facility concurrence summary ───────────────────────────────────
  const byFac = {}
  filtered.forEach(r => { (byFac[r.facilityName || 'Unknown'] ??= []).push(r) })
  const facStats = Object.entries(byFac).map(([fac, rows]) => {
    let ex = 0, un = 0, ov = 0
    const concs = []
    rows.forEach(r => {
      const c = aggClass(r.reported, r.validated)
      if (c === 'Accurately reported') ex++
      else if (c === 'Under-reported') un++
      else ov++
      const conc = aggConc(r.reported, r.validated)
      if (conc != null) concs.push(conc)
    })
    const sumR = rows.reduce((s, r) => s + Number(r.reported  ?? 0), 0)
    const sumV = rows.reduce((s, r) => s + Number(r.validated ?? 0), 0)
    return {
      fac, audited: rows.length, exact: ex, under: un, over: ov,
      exactRate: rows.length ? ex / rows.length * 100 : null,
      totalReported: sumR, totalValidated: sumV,
      weightedConc: sumV > 0 ? sumR / sumV * 100 : null,
      avgConc: avg(concs),
    }
  }).sort((a, b) => (b.exactRate ?? -1) - (a.exactRate ?? -1))

  // ── Indicator concurrence summary ──────────────────────────────────
  const byInd = {}
  filtered.forEach(r => { (byInd[r.indicator || 'Unknown'] ??= []).push(r) })
  const indStats = Object.entries(byInd).map(([ind, rows]) => {
    let ex = 0, un = 0, ov = 0
    const concs = []
    rows.forEach(r => {
      const c = aggClass(r.reported, r.validated)
      if (c === 'Accurately reported') ex++
      else if (c === 'Under-reported') un++
      else ov++
      const conc = aggConc(r.reported, r.validated)
      if (conc != null) concs.push(conc)
    })
    return { ind, facilities: rows.length, exact: ex, under: un, over: ov, avgConc: avg(concs) }
  }).sort((a, b) => a.ind.localeCompare(b.ind))

  // ── Priority discrepancy list ──────────────────────────────────────
  const RANK = { High: 3, Medium: 2, Low: 1, Monitor: 0 }
  const discrepancies = filtered
    .filter(r => aggClass(r.reported, r.validated) !== 'Accurately reported')
    .map(r => ({
      ...r,
      _cls: aggClass(r.reported, r.validated),
      _conc: aggConc(r.reported, r.validated),
      _priority: rowPriority(r.reported, r.validated),
      _variance: Number(r.reported ?? 0) - Number(r.validated ?? 0),
    }))
    .sort((a, b) => (RANK[b._priority] ?? 0) - (RANK[a._priority] ?? 0))

  // ── Trend data ─────────────────────────────────────────────────────
  const trendBase = records.filter(r =>
    (!filters.state     || r.state     === filters.state) &&
    (!filters.lga       || r.lga       === filters.lga) &&
    (!filters.facilityName || (r.facilityName || '').toLowerCase().includes(filters.facilityName.toLowerCase()))
  )
  const trendIndOpts = [...new Set(trendBase.map(r => r.indicator).filter(Boolean))].sort()
  const trendRows    = trendIndicator ? trendBase.filter(r => r.indicator === trendIndicator) : trendBase
  const trendPeriods = [...new Set(trendRows.map(r => r.period).filter(Boolean))].sort()
  const trendData    = trendPeriods.map(p => {
    const rows = trendRows.filter(r => r.period === p)
    const concs = rows.map(r => aggConc(r.reported, r.validated)).filter(v => v != null)
    return avg(concs)
  })

  // ── Charts ─────────────────────────────────────────────────────────
  const facChartCfg = facStats.length ? {
    type: 'bar',
    data: {
      labels: facStats.map(f => f.fac.length > 22 ? f.fac.slice(0, 22) + '…' : f.fac),
      datasets: [{
        label: 'Exact match rate %',
        data: facStats.map(f => f.exactRate != null ? +f.exactRate.toFixed(1) : 0),
        backgroundColor: '#2db58dcc',
        borderColor: '#2db58d',
        borderWidth: 1,
      }],
    },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { x: { min: 0, max: 100, ticks: { callback: v => v + '%' } } },
    },
  } : null

  const trendCfg = trendPeriods.length > 1 ? {
    type: 'line',
    data: {
      labels: trendPeriods,
      datasets: [{
        label: trendIndicator ? `${trendIndicator}` : 'Average %',
        data: trendData.map(v => v != null ? +v.toFixed(1) : null),
        borderColor: '#0f7a5b',
        backgroundColor: '#0f7a5b22',
        fill: true,
        tension: 0.3,
        pointRadius: 4,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: true, position: 'top', labels: { boxWidth: 12, font: { size: 11 } } } },
      scales: { y: { min: 0, max: 130, ticks: { callback: v => v + '%' } } },
    },
  } : null

  useChart(facChartRef, facChartCfg)
  useChart(trendRef, trendCfg)

  if (loading) return <div className="alert alert-info">Loading aggregate data…</div>

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Aggregate Concurrence Analytics</h1>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        {[
          ['period',    'Period',    periods],
          ['state',     'State',     states],
          ['lga',       'LGA',       lgas],
          ['indicator', 'Indicator', indicators],
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
          <input value={filters.facilityName} onChange={e => setFilters(f => ({ ...f, facilityName: e.target.value }))} placeholder="Filter…" />
        </div>
      </div>

      {/* KPI row 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '0.75rem' }}>
        {[
          ['AUDITED INDICATORS',  filtered.length, undefined],
          ['ACCURATELY REPORTED', exact,           exact > 0 ? 'var(--good)' : undefined],
          ['UNDER-REPORTED',      under,           under > 0 ? 'var(--warn)' : undefined],
          ['OVER-REPORTED',       over,            over  > 0 ? 'var(--bad)'  : undefined],
        ].map(([label, value, color]) => (
          <div key={label} className="kpi-card">
            <div className="kpi-label" style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
            <div className="kpi-value" style={{ fontSize: '2rem', color: color || 'var(--ink)' }}>{value}</div>
            {label === 'ACCURATELY REPORTED' && filtered.length > 0 && (
              <div className="kpi-sub">{(exact / filtered.length * 100).toFixed(1)}% indicator rows at 100%</div>
            )}
          </div>
        ))}
      </div>

      {/* KPI row 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.25rem' }}>
        <div className="kpi-card">
          <div className="kpi-label" style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>TOTAL REPORTING</div>
          <div className="kpi-value" style={{ fontSize: '2rem' }}>{totalReported.toLocaleString()}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label" style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>TOTAL VALIDATED</div>
          <div className="kpi-value" style={{ fontSize: '2rem' }}>{totalValidated.toLocaleString()}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label" style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>OVERALL WEIGHTED CONCURRENCE %</div>
          <div className="kpi-value" style={{ fontSize: '2rem', color: aggClassificationColor(totalReported, totalValidated) }}>{fmtPct(weightedConc)}</div>
        </div>
      </div>

      {/* Facility summary + Indicator summary side by side */}
      <div className="agg-summary-grid">

        {/* Facility concurrence summary */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontWeight: 700, fontSize: '0.9375rem' }}>Facility concurrence summary</div>
            <span style={{ fontSize: '0.75rem', color: 'var(--muted)', background: 'var(--bg)', padding: '2px 8px', borderRadius: 4 }}>Aggregate</span>
          </div>
          <div className="table-wrap" style={{ maxHeight: 320, overflowY: 'auto' }}>
            <table className="agg-summary-table">
              <thead>
                <tr>
                  <th className="th-facility">Facility</th>
                  <th className="th-wrap-num">Audited<br />indicators</th>
                  <th className="th-wrap-num">Accurately<br />reported</th>
                  <th className="th-wrap-num">Under-<br />reported</th>
                  <th className="th-wrap-num">Over-<br />reported</th>
                  <th className="th-wrap-num">Accurate<br />reporting<br />rate</th>
                  <th className="th-wrap-num">Total<br />reported</th>
                  <th className="th-wrap-num">Total<br />validated</th>
                  <th className="th-wrap-num">Overall<br />weighted<br />concurrence</th>
                  <th className="th-wrap-num">Average<br />concurrence<br />%</th>
                </tr>
              </thead>
              <tbody>
                {facStats.length === 0 ? (
                  <tr><td colSpan={10} style={{ textAlign: 'center', color: 'var(--muted)', padding: '1.5rem' }}>No data</td></tr>
                ) : facStats.map(f => (
                  <tr key={f.fac}>
                    <td className="td-facility" title={f.fac}>{f.fac}</td>
                    <td className="td-num">{f.audited}</td>
                    <td className="td-num" style={{ color: 'var(--good)' }}>{f.exact}</td>
                    <td className="td-num" style={{ color: f.under > 0 ? 'var(--warn)' : undefined }}>{f.under}</td>
                    <td className="td-num" style={{ color: f.over  > 0 ? 'var(--bad)'  : undefined }}>{f.over}</td>
                    <td className="td-num" style={{ fontWeight: 700, color: cc(f.exactRate) }}>{fmtPct(f.exactRate)}</td>
                    <td className="td-num" style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{f.totalReported.toLocaleString()}</td>
                    <td className="td-num" style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{f.totalValidated.toLocaleString()}</td>
                    <td className="td-num" style={{ fontWeight: 700, color: aggClassificationColor(f.totalReported, f.totalValidated) }}>{fmtPct(f.weightedConc)}</td>
                    <td className="td-num" style={{ color: cc(f.avgConc) }}>{fmtPct(f.avgConc)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Indicator concurrence summary */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontWeight: 700, fontSize: '0.9375rem' }}>Indicator concurrence summary</div>
            <span style={{ fontSize: '0.75rem', color: 'var(--muted)', background: 'var(--bg)', padding: '2px 8px', borderRadius: 4 }}>Aggregate</span>
          </div>
          <div className="table-wrap" style={{ maxHeight: 320, overflowY: 'auto' }}>
            <table className="agg-summary-table">
              <thead>
                <tr>
                  <th className="th-indicator">Indicator</th>
                  <th className="th-wrap-num">Facilities<br />audited</th>
                  <th className="th-wrap-num">Accurately<br />reported</th>
                  <th className="th-wrap-num">Under-<br />reported</th>
                  <th className="th-wrap-num">Over-<br />reported</th>
                  <th className="th-wrap-num">Average<br />concurrence<br />%</th>
                </tr>
              </thead>
              <tbody>
                {indStats.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: '1.5rem' }}>No data</td></tr>
                ) : indStats.map(i => (
                  <tr key={i.ind}>
                    <td className="td-indicator">{i.ind}</td>
                    <td className="td-num">{i.facilities}</td>
                    <td className="td-num" style={{ color: 'var(--good)' }}>{i.exact}</td>
                    <td className="td-num" style={{ color: i.under > 0 ? 'var(--warn)' : undefined }}>{i.under}</td>
                    <td className="td-num" style={{ color: i.over  > 0 ? 'var(--bad)'  : undefined }}>{i.over}</td>
                    <td className="td-num" style={{ fontWeight: 700, color: cc(i.avgConc) }}>{fmtPct(i.avgConc)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Facility exact match rate chart + Trend chart */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>Facility exact match rate</div>
            <span style={{ fontSize: '0.75rem', color: 'var(--muted)', background: 'var(--bg)', padding: '2px 8px', borderRadius: 4 }}>Aggregate</span>
          </div>
          {facStats.length === 0 ? (
            <div style={{ height: 260 }}><canvas ref={facChartRef} /></div>
          ) : (
            <div style={{ height: Math.max(200, facStats.length * 28) }}><canvas ref={facChartRef} /></div>
          )}
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>Concurrence trend by period</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Average %</span>
              <select value={trendIndicator} onChange={e => setTrendIndicator(e.target.value)} style={{ fontSize: '0.78rem', padding: '2px 6px', border: '1px solid var(--line)', borderRadius: 4 }}>
                <option value="">All indicators</option>
                {trendIndOpts.map(i => <option key={i}>{i}</option>)}
              </select>
            </div>
          </div>
          {trendPeriods.length <= 1 ? (
            <div style={{ height: 260, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: '0.85rem', gap: 8 }}>
              <div>Trend requires ≥ 2 periods</div>
              <div style={{ fontSize: '0.75rem' }}>Currently: {trendPeriods.length === 0 ? '0 periods' : trendPeriods[0]}</div>
            </div>
          ) : (
            <div style={{ height: 260 }}><canvas ref={trendRef} /></div>
          )}
        </div>
      </div>

      {/* Priority discrepancy list */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontWeight: 700, fontSize: '0.9375rem' }}>Priority discrepancy list</div>
          <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
            {discrepancies.length > 0 ? `${discrepancies.length} rows — anything not at 100% needs attention` : 'No discrepancies found'}
          </span>
        </div>
        <div className="table-wrap" style={{ maxHeight: 420, overflowY: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Period</th>
                <th>Facility</th>
                <th>Indicator</th>
                <th style={{ textAlign: 'right' }}>DHIS</th>
                <th style={{ textAlign: 'right' }}>Validated</th>
                <th style={{ textAlign: 'right' }}>Variance</th>
                <th style={{ textAlign: 'right' }}>Concurrence %</th>
                <th>Classification</th>
              </tr>
            </thead>
            <tbody>
              {discrepancies.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', color: 'var(--muted)', padding: '2rem' }}>
                    All indicators accurately reported — no discrepancies to show.
                  </td>
                </tr>
              ) : discrepancies.map(r => (
                <tr key={r.id}>
                  <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{r.period || '—'}</td>
                  <td style={{ fontWeight: 600, maxWidth: 160, fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.facilityName}>{r.facilityName}</td>
                  <td style={{ fontWeight: 600, fontSize: '0.85rem' }}>{r.indicator}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmtNum(r.reported)}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmtNum(r.validated)}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: r._variance > 0 ? 'var(--bad)' : 'var(--warn)' }}>
                    {r._variance > 0 ? '+' : ''}{r._variance.toLocaleString()}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: cc(r._conc) }}>{fmtPct(r._conc)}</td>
                  <td>
                    <span className={`badge ${r._cls === 'Over-reported' ? 'badge-bad' : 'badge-warn'}`}>{r._cls}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
