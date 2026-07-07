'use client'
import { useState, useEffect, useRef } from 'react'
import { Chart, registerables } from 'chart.js'
import { filterAllOptionLabel } from '@/lib/hq-filters'

Chart.register(...registerables)

const CHART_BLUE = '#7ec8e3'

const ELEMENTS = [
  { key: 'Sex',            label: 'Sex' },
  { key: 'Age',            label: 'Age at ART start' },
  { key: 'ArtStartDate',   label: 'ART start date' },
  { key: 'RegimenLine',    label: 'Regimen line at ART start' },
  { key: 'Regimen',        label: 'Regimen at ART start' },
  { key: 'PharmacyPickup', label: 'Last pickup date' },
  { key: 'DaysRefill',     label: 'Days of ARV refill' },
  { key: 'TbStatus',       label: 'Current TB status' },
  { key: 'Pregnancy',      label: 'Current pregnancy status' },
]

function elResult(emrVal, folderVal) {
  const e = emrVal != null && String(emrVal).trim() !== ''
  const f = folderVal != null && String(folderVal).trim() !== ''
  if (!e && !f) return 'BothMissing'
  if (e && !f) return 'MissFolder'
  if (!e && f) return 'MissEMR'
  return String(emrVal).trim().toLowerCase() === String(folderVal).trim().toLowerCase() ? 'Match' : 'Mismatch'
}

function getElementStats(records) {
  return ELEMENTS.map(el => {
    let match = 0, mismatch = 0, missFolder = 0, missEMR = 0, comparable = 0
    for (const r of records) {
      const res = elResult(r['emr' + el.key], r['folder' + el.key])
      if (res === 'BothMissing') continue
      comparable++
      if (res === 'Match') match++
      else if (res === 'Mismatch') mismatch++
      else if (res === 'MissFolder') missFolder++
      else missEMR++
    }
    return { ...el, comparable, match, mismatch, missFolder, missEMR, pct: comparable > 0 ? match / comparable * 100 : null }
  })
}

function pmrOnlyPct(r) {
  if (r.emrOnlyPct != null) return r.emrOnlyPct
  if (!r.recordFound || r.recordFound === 'No') return null
  let emrFilled = 0, folderFilled = 0
  for (const el of ELEMENTS) {
    const emr = (r['emr' + el.key] || '').trim()
    const folder = (r['folder' + el.key] || '').trim()
    if (emr) emrFilled++
    if (folder) folderFilled++
  }
  const pmrOnly = 9 - emrFilled
  if (pmrOnly <= 0) return folderFilled > 0 ? 100 : null
  const pmrOnlyFilled = Math.max(0, folderFilled - Math.min(folderFilled, emrFilled))
  return Math.round(pmrOnlyFilled / pmrOnly * 1000) / 10
}

function avg(arr) {
  const vals = arr.filter(v => v != null && !isNaN(v))
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
}

function fmtPct(v, dec = 1) {
  return v != null ? Number(v).toFixed(dec) + '%' : '—'
}

function ratio(n, d, dec = 1) {
  if (!d) return '—'
  return (n / d * 100).toFixed(dec) + '%'
}

function cc(v) {
  if (v == null) return 'var(--ink)'
  return v >= 95 ? 'var(--good)' : v >= 80 ? 'var(--warn)' : 'var(--bad)'
}

function recaptureLabel(r) {
  const valid = String(r.recaptureDateValid || '').toLowerCase()
  if (valid === 'valid') return { type: 'badge', text: 'Valid' }
  if (valid.includes('invalid')) return { type: 'badge', text: 'Invalid', bad: true }
  if (r.recaptureDate) return { type: 'text', text: r.recaptureDate }
  if (r.remarks && r.remarks.toLowerCase().includes('recapture')) {
    const m = r.remarks.match(/not applicable until[^.]+/i)
    if (m) return { type: 'text', text: m[0] }
  }
  return { type: 'text', text: '—' }
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

function CardHeader({ title, badge }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
      <h3 style={{ margin: 0, fontWeight: 700, fontSize: '0.9375rem' }}>{title}</h3>
      {badge && <span className="badge badge-info">{badge}</span>}
    </div>
  )
}

export default function HqTxPage() {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ period: '', state: '', lga: '', facilityName: '' })

  const facRef = useRef(null)
  const elRef = useRef(null)

  useEffect(() => {
    fetch('/api/tx').then(r => r.json()).then(data => {
      setRecords(Array.isArray(data) ? data : [])
      setLoading(false)
    })
  }, [])

  const periods = [...new Set(records.map(r => r.period).filter(Boolean))].sort()
  const states  = [...new Set(records.map(r => r.state).filter(Boolean))].sort()
  const lgas    = [...new Set(records.filter(r => !filters.state || r.state === filters.state).map(r => r.lga).filter(Boolean))].sort()
  const facs    = [...new Set(
    records.filter(r => (!filters.state || r.state === filters.state) && (!filters.lga || r.lga === filters.lga))
      .map(r => r.facilityName).filter(Boolean)
  )].sort()

  const filtered = records.filter(r =>
    (!filters.period || r.period === filters.period) &&
    (!filters.state  || r.state  === filters.state) &&
    (!filters.lga    || r.lga    === filters.lga) &&
    (!filters.facilityName || r.facilityName === filters.facilityName)
  )

  const found = filtered.filter(r => r.recordFound === 'Yes' || r.recordFound === 'Partial')
  const elStats = getElementStats(found)

  const facMap = {}
  filtered.forEach(r => { (facMap[r.facilityName || 'Unknown'] ??= []).push(r) })
  const facStats = Object.entries(facMap).map(([fac, rows]) => {
    const fnd = rows.filter(r => r.recordFound === 'Yes' || r.recordFound === 'Partial')
    return {
      fac,
      linked: rows.length,
      found: fnd.length,
      folderRate: rows.length ? fnd.length / rows.length * 100 : null,
      completeness: avg(fnd.map(r => r.folderCompletenessPct)),
      concurrence: avg(fnd.map(r => r.concurrencePct)),
      pmrOnly: avg(fnd.map(pmrOnlyPct)),
    }
  }).sort((a, b) => (b.concurrence ?? -1) - (a.concurrence ?? -1))

  function cascMetrics(rows) {
    const f = rows.filter(r => r.recordFound === 'Yes' || r.recordFound === 'Partial')
    return {
      clientsFound: rows.length,
      foldersFound: f.length,
      complete: f.filter(r => (r.folderCompletenessPct ?? 0) >= 100).length,
      accurate: f.filter(r => (r.concurrencePct ?? 0) >= 100).length,
    }
  }

  const byFacility = new Map()
  for (const r of filtered) {
    const fac = r.facilityName || 'Unknown'
    if (!byFacility.has(fac)) {
      byFacility.set(fac, {
        state: r.state || 'Unknown',
        lga: r.lga || 'Unknown',
        fac,
        rows: [],
      })
    }
    byFacility.get(fac).rows.push(r)
  }

  const cascade = [...byFacility.values()]
    .sort((a, b) => a.state.localeCompare(b.state) || a.lga.localeCompare(b.lga) || a.fac.localeCompare(b.fac))
    .map(({ state, lga, fac, rows }) => ({
      state,
      lga,
      fac,
      ...cascMetrics(rows),
    }))

  const exceptions = filtered.filter(r =>
    r.recordFound === 'No' ||
    (r.concurrencePct != null && r.concurrencePct < 100) ||
    String(r.recaptureDateValid || '').toLowerCase().includes('invalid') ||
    (r.remarks && r.remarks.trim())
  )

  const validRecapture = found.filter(r =>
    String(r.pbsEmr || '').toLowerCase() === 'yes' &&
    String(r.recaptureEmr || '').toLowerCase() === 'yes' &&
    r.recaptureDate &&
    String(r.recaptureDateValid || '').toLowerCase() === 'valid'
  ).length

  const totalConc = avg(found.map(r => r.concurrencePct))
  const totalComp = avg(found.map(r => r.folderCompletenessPct))
  const totalPmr  = avg(found.map(pmrOnlyPct))

  const chartBase = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
  }

  const facChartCfg = facStats.length ? {
    type: 'bar',
    data: {
      labels: facStats.map(f => f.fac.length > 28 ? f.fac.slice(0, 28) + '…' : f.fac),
      datasets: [{
        label: 'Mean %',
        data: facStats.map(f => f.concurrence != null ? +f.concurrence.toFixed(1) : 0),
        backgroundColor: CHART_BLUE,
        borderColor: CHART_BLUE,
        borderWidth: 0,
        borderRadius: 2,
      }],
    },
    options: {
      ...chartBase,
      scales: {
        y: { min: 0, max: 100, title: { display: true, text: 'Mean %', font: { size: 11 } }, ticks: { callback: v => v + '%' } },
        x: { ticks: { maxRotation: 45, minRotation: 0, font: { size: 10 } } },
      },
    },
  } : null

  const elChartCfg = {
    type: 'bar',
    data: {
      labels: elStats.map(e => e.label),
      datasets: [{
        label: 'Concurrence %',
        data: elStats.map(e => e.pct != null ? +e.pct.toFixed(1) : 0),
        backgroundColor: CHART_BLUE,
        borderColor: CHART_BLUE,
        borderWidth: 0,
        borderRadius: 2,
      }],
    },
    options: {
      ...chartBase,
      scales: {
        y: { min: 0, max: 100, title: { display: true, text: 'Concurrence %', font: { size: 11 } }, ticks: { callback: v => v + '%' } },
        x: { ticks: { maxRotation: 55, minRotation: 45, font: { size: 9 } } },
      },
    },
  }

  useChart(facRef, facChartCfg)
  useChart(elRef, elChartCfg)

  if (loading) return <div className="alert alert-info">Loading TX data…</div>

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">TX_NEW Client-Level Analytics</h1>
      </div>

      <div className="filter-bar">
        {[
          ['period',       'Period',   periods],
          ['state',        'State',    states],
          ['lga',          'LGA',      lgas],
          ['facilityName', 'Facility', facs],
        ].map(([key, label, opts]) => (
          <div className="form-field" key={key}>
            <label>{label}</label>
            <select value={filters[key]} onChange={e => setFilters(f => ({ ...f, [key]: e.target.value }))}>
              <option value="">{filterAllOptionLabel(label)}</option>
              {opts.map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
        ))}
      </div>

      {/* KPI row */}
      <div className="kpi-grid-6">
        {[
          ['Total TX_NEW', filtered.length, null, null],
          ['Folders found rate', filtered.length ? ratio(found.length, filtered.length) : '—', filtered.length ? `${found.length} of ${filtered.length} found` : '0 of 0 found', null],
          ['Folder completeness %', fmtPct(totalComp), found.length ? `across ${found.length} folders found` : 'no folders found', cc(totalComp)],
          ['Mean concurrence', fmtPct(totalConc), null, cc(totalConc)],
          ['Mean PMR only compltn/pree', fmtPct(totalPmr), null, null],
          ['Valid recapture', String(validRecapture), 'Found + PBS yes + recapture yes + date populated + valid', null],
        ].map(([label, value, sub, color]) => (
          <div className="kpi-card" key={label}>
            <div className="kpi-label">{label}</div>
            <div className="kpi-value" style={color ? { color } : undefined}>{value}</div>
            {sub && <div className="kpi-sub">{sub}</div>}
          </div>
        ))}
      </div>

      {/* Summary cascade */}
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <h3 style={{ margin: 0, fontWeight: 700, fontSize: '0.9375rem' }}>Summary cascade table</h3>
          <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>One row per facility</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>State</th>
                <th>LGA</th>
                <th>Facility</th>
                <th style={{ textAlign: 'right' }}>Clients found</th>
                <th style={{ textAlign: 'right' }}>Folders found</th>
                <th style={{ textAlign: 'right' }}>Folders with complete documentation</th>
                <th style={{ textAlign: 'right' }}>Folders with accurate PMR assessment</th>
              </tr>
            </thead>
            <tbody>
              {cascade.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)', padding: '1rem' }}>No data yet.</td></tr>
              ) : cascade.map(row => (
                    <tr key={row.fac}>
                      <td>{row.state}</td>
                      <td>{row.lga || '—'}</td>
                      <td style={{ fontWeight: 600 }}>{row.fac}</td>
                      <td style={{ textAlign: 'right' }}>{row.clientsFound}</td>
                      <td style={{ textAlign: 'right' }}>
                        {row.foldersFound}
                        <span style={{ color: 'var(--muted)', fontSize: '0.75rem' }}> ({ratio(row.foldersFound, row.clientsFound)})</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>{row.complete}</td>
                      <td style={{ textAlign: 'right', color: cc(row.foldersFound > 0 ? row.accurate / row.foldersFound * 100 : null) }}>
                        {row.accurate}
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Facility summary + element concurrence */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
        <div className="card">
          <CardHeader title="Facility summary" badge="TX_NEW" />
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Facility</th>
                  <th style={{ textAlign: 'right' }}>Linked</th>
                  <th style={{ textAlign: 'right' }}>Folders found</th>
                  <th style={{ textAlign: 'right' }}>Folders found %</th>
                  <th style={{ textAlign: 'right' }}>Folder completeness %</th>
                  <th style={{ textAlign: 'right' }}>Mean concurrence %</th>
                  <th style={{ textAlign: 'right' }}>PMR only %</th>
                </tr>
              </thead>
              <tbody>
                {facStats.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)', padding: '1rem' }}>No data yet.</td></tr>
                ) : facStats.map(f => (
                      <tr key={f.fac}>
                        <td style={{ fontWeight: 600, maxWidth: 180, fontSize: '0.8rem' }} title={f.fac}>{f.fac}</td>
                        <td style={{ textAlign: 'right' }}>{f.linked}</td>
                        <td style={{ textAlign: 'right' }}>{f.found}</td>
                        <td style={{ textAlign: 'right' }}>{fmtPct(f.folderRate)}</td>
                        <td style={{ textAlign: 'right', color: cc(f.completeness) }}>{fmtPct(f.completeness)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: cc(f.concurrence) }}>{fmtPct(f.concurrence)}</td>
                        <td style={{ textAlign: 'right' }}>{fmtPct(f.pmrOnly)}</td>
                      </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <CardHeader title="Comparable element concurrence" badge="TX_NEW" />
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Element</th>
                  <th style={{ textAlign: 'right' }}>Comparable</th>
                  <th style={{ textAlign: 'right' }}>Match</th>
                  <th style={{ textAlign: 'right' }}>Mismatch</th>
                  <th style={{ textAlign: 'right' }}>Missing in Folder</th>
                  <th style={{ textAlign: 'right' }}>Missing in EMR</th>
                  <th style={{ textAlign: 'right' }}>Concurrence %</th>
                </tr>
              </thead>
              <tbody>
                {elStats.map(e => (
                      <tr key={e.key}>
                        <td style={{ fontSize: '0.8rem', fontWeight: 600 }}>{e.label}</td>
                        <td style={{ textAlign: 'right' }}>{e.comparable}</td>
                        <td style={{ textAlign: 'right', color: 'var(--good)' }}>{e.match}</td>
                        <td style={{ textAlign: 'right', color: e.mismatch > 0 ? 'var(--bad)' : 'var(--muted)' }}>{e.mismatch}</td>
                        <td style={{ textAlign: 'right', color: e.missFolder > 0 ? 'var(--warn)' : 'var(--muted)' }}>{e.missFolder}</td>
                        <td style={{ textAlign: 'right', color: e.missEMR > 0 ? 'var(--info)' : 'var(--muted)' }}>{e.missEMR}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: cc(e.pct) }}>{fmtPct(e.pct)}</td>
                      </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
        <div className="card">
          <div style={{ marginBottom: 8, fontWeight: 700, fontSize: '0.875rem' }}>Facility concurrence chart</div>
          <div style={{ height: 300 }}><canvas ref={facRef} /></div>
        </div>
        <div className="card">
          <div style={{ marginBottom: 8, fontWeight: 700, fontSize: '0.875rem' }}>Element-level chart</div>
          <div style={{ height: 300 }}><canvas ref={elRef} /></div>
        </div>
      </div>

      {/* Client-level exceptions */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <h3 style={{ margin: 0, fontWeight: 700, fontSize: '0.9375rem' }}>Client-level exceptions</h3>
          <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>
            {exceptions.length} record{exceptions.length !== 1 ? 's' : ''} flagged
          </span>
        </div>
        <div className="table-wrap" style={{ maxHeight: 420, overflowY: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Facility</th>
                <th>PepID</th>
                <th>Folders found</th>
                <th style={{ textAlign: 'right' }}>Concurrence %</th>
                <th style={{ textAlign: 'right' }}>PMR only %</th>
                <th>Recapture valid/after</th>
                <th style={{ minWidth: 280 }}>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {exceptions.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)', padding: '1rem' }}>No exceptions in this filter.</td></tr>
              ) : exceptions.map(r => {
                    const recap = recaptureLabel(r)
                    return (
                      <tr key={r.id}>
                        <td style={{ fontWeight: 600, fontSize: '0.8rem', maxWidth: 160, verticalAlign: 'top' }} title={r.facilityName}>{r.facilityName}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', verticalAlign: 'top' }}>{r.pepId || r.patientId || '—'}</td>
                        <td style={{ verticalAlign: 'top' }}>
                          <span className={`badge ${r.recordFound === 'Yes' ? 'badge-good' : r.recordFound === 'Partial' ? 'badge-warn' : 'badge-bad'}`}>
                            {r.recordFound || '—'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: cc(r.concurrencePct), verticalAlign: 'top' }}>{fmtPct(r.concurrencePct)}</td>
                        <td style={{ textAlign: 'right', verticalAlign: 'top' }}>{fmtPct(pmrOnlyPct(r))}</td>
                        <td style={{ verticalAlign: 'top', fontSize: '0.75rem', maxWidth: 160 }}>
                          {recap.type === 'badge' ? (
                            <span className={`badge ${recap.bad ? 'badge-bad' : 'badge-good'}`}>{recap.text}</span>
                          ) : recap.text}
                        </td>
                        <td style={{ fontSize: '0.75rem', lineHeight: 1.45, verticalAlign: 'top', whiteSpace: 'normal' }}>{r.remarks || '—'}</td>
                      </tr>
                    )
                  })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
