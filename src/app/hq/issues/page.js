'use client'
import { useState, useEffect, useMemo } from 'react'
import SearchableSelect from '@/components/SearchableSelect'
import { normalizeAggValidationPayload, normalizeTxValidationPayload } from '@/lib/dqa-entry'
import { filterAllOptionLabel, uniqueSortedFacilities } from '@/lib/hq-filters'
import {
  applyAggIssueResolution,
  applyTxIssueResolution,
  buildAssessorAccountabilityMatrix,
  collectAllValidationIssues,
  HQ_ISSUE_STATUS_OPTIONS,
  hqStatusToResolutionStatus,
  isHqIssueResolved,
  manualIssueToHqRow,
  validationIssueToHqRow,
} from '@/lib/validation-issues'
import { normalizeSingleResolution, parseStoredMismatchResolutions } from '@/lib/mismatch-resolution'

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

export default function HqIssuesPage() {
  const [issues, setIssues] = useState([])
  const [filters, setFilters] = useState({ period: '', state: '', status: '', facility: '' })
  const [loading, setLoading] = useState(true)
  const [editId, setEditId] = useState(null)
  const [editStatus, setEditStatus] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => { loadIssues() }, [])

  async function loadIssues() {
    setLoading(true)
    try {
      const [txRes, aggRes, issueRes] = await Promise.all([
        fetch('/api/tx', { credentials: 'include' }),
        fetch('/api/agg', { credentials: 'include' }),
        fetch('/api/issues', { credentials: 'include' }),
      ])
      const tx = txRes.ok ? await txRes.json() : []
      const agg = aggRes.ok ? await aggRes.json() : []
      const manual = issueRes.ok ? await issueRes.json() : []

      const validationRows = collectAllValidationIssues(
        Array.isArray(tx) ? tx : [],
        Array.isArray(agg) ? agg : [],
      ).map(validationIssueToHqRow)

      const manualRows = (Array.isArray(manual) ? manual : []).map(manualIssueToHqRow)
      setIssues([...validationRows, ...manualRows])
    } finally {
      setLoading(false)
    }
  }

  const periods = [...new Set(issues.map(r => r.period).filter(Boolean))].sort()
  const states = [...new Set(issues.map(r => r.state).filter(Boolean))].sort()
  const facilityOptions = useMemo(
    () => uniqueSortedFacilities(
      issues.filter(i => (!filters.period || i.period === filters.period) && (!filters.state || i.state === filters.state)),
      { key: 'facility' },
    ),
    [issues, filters.period, filters.state],
  )

  useEffect(() => {
    if (filters.facility && !facilityOptions.includes(filters.facility)) {
      setFilters(current => ({ ...current, facility: '' }))
    }
  }, [facilityOptions, filters.facility])

  const filtered = issues.filter(i =>
    (!filters.period || i.period === filters.period) &&
    (!filters.state || i.state === filters.state) &&
    (!filters.status || i.status === filters.status) &&
    (!filters.facility || i.facility === filters.facility)
  )

  const annotated = filtered.map(i => ({ ...i, _flag: dueFlag(i.dueDate, i.status) }))

  const today = new Date().toISOString().slice(0, 10)
  const overdueItems = annotated.filter(i => i._flag === 'Overdue')
  const dueSoonItems = annotated.filter(i => i._flag === 'Due soon')
  const openCount = annotated.filter(i => !isHqIssueResolved(i.status)).length
  const resolvedCount = annotated.filter(i => isHqIssueResolved(i.status)).length

  async function updateStatus(issue) {
    setSaving(true)
    try {
      if (issue.source === 'tx') {
        const resolutions = parseStoredMismatchResolutions(issue.parentRecord)
        const current = resolutions[issue.fieldKey] || {}
        const updated = applyTxIssueResolution(issue.parentRecord, issue.fieldKey, {
          ...current,
          status: hqStatusToResolutionStatus(editStatus),
        })
        const r = await fetch('/api/tx', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(normalizeTxValidationPayload(updated)),
        })
        if (!r.ok) throw new Error()
      } else if (issue.source === 'agg') {
        const current = normalizeSingleResolution(issue.parentRecord?.mismatchResolution) || {}
        const updated = applyAggIssueResolution(issue.parentRecord, {
          ...current,
          status: hqStatusToResolutionStatus(editStatus),
        })
        const r = await fetch('/api/agg', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify([normalizeAggValidationPayload(updated)]),
        })
        if (!r.ok) throw new Error()
      } else {
        const manual = issue._manualRecord || issue
        const r = await fetch('/api/issues', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...manual,
            id: issue.id,
            status: editStatus,
            statusDate: today,
          }),
        })
        if (!r.ok) throw new Error()
      }

      await loadIssues()
      setEditId(null)
      setMsg({ type: 'success', text: 'Status updated.' })
    } catch {
      setMsg({ type: 'error', text: 'Update failed.' })
    } finally {
      setSaving(false)
      setTimeout(() => setMsg(null), 3000)
    }
  }

  async function deleteIssue(issue) {
    if (issue.source !== 'manual') return
    if (!confirm('Delete this issue? This cannot be undone.')) return
    await fetch(`/api/issues?id=${issue.id}`, { method: 'DELETE', credentials: 'include' })
    await loadIssues()
  }

  const byPerson = buildAssessorAccountabilityMatrix(annotated)

  const byFacility = {}
  for (const i of annotated) {
    const f = i.facility || 'Unassigned'
    if (!byFacility[f]) byFacility[f] = { total: 0, resolved: 0, overdue: 0, open: 0 }
    byFacility[f].total++
    if (isHqIssueResolved(i.status)) byFacility[f].resolved++
    if (i._flag === 'Overdue') byFacility[f].overdue++
    if (!isHqIssueResolved(i.status)) byFacility[f].open++
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Issues &amp; Accountability Register</h1>
        <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginTop: 4 }}>
          Includes mismatch resolutions from TX and aggregate validations, plus manually logged issues.
          The assessor matrix totals match the issues register: every TX_NEW, aggregate, and manual issue is counted under that validation&apos;s assessor.
        </p>
      </div>

      {msg && <div className={`alert alert-${msg.type === 'success' ? 'good' : 'bad'}`} style={{ marginBottom: '1rem' }}>{msg.text}</div>}

      {overdueItems.length > 0 && (
        <div className="alert alert-bad" style={{ marginBottom: '1rem' }}>
          <strong>{overdueItems.length} issue{overdueItems.length !== 1 ? 's' : ''} overdue.</strong> Review and escalate as needed.
        </div>
      )}
      {dueSoonItems.length > 0 && (
        <div className="alert alert-warn" style={{ marginBottom: '1rem' }}>
          <strong>{dueSoonItems.length} issue{dueSoonItems.length !== 1 ? 's' : ''} due within 7 days.</strong>
        </div>
      )}

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
        <div className="form-field">
          <label>Status</label>
          <select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
            <option value="">All statuses</option>
            {HQ_ISSUE_STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <SearchableSelect
          label="Facility"
          value={filters.facility}
          onChange={facility => setFilters(current => ({ ...current, facility }))}
          options={facilityOptions}
          allLabel={filterAllOptionLabel('Facility')}
          placeholder="Search facilities…"
        />
      </div>

      <div className="kpi-grid" style={{ marginBottom: '1.25rem' }}>
        <div className="kpi-card"><div className="kpi-label">Total issues</div><div className="kpi-value">{annotated.length}</div></div>
        <div className="kpi-card"><div className="kpi-label">Open</div><div className="kpi-value" style={{ color: openCount > 0 ? 'var(--warn)' : 'var(--good)' }}>{openCount}</div></div>
        <div className="kpi-card"><div className="kpi-label">Resolved</div><div className="kpi-value" style={{ color: 'var(--good)' }}>{resolvedCount}</div></div>
        <div className="kpi-card"><div className="kpi-label">Overdue</div><div className="kpi-value" style={{ color: overdueItems.length ? 'var(--bad)' : 'var(--good)' }}>{overdueItems.length}</div></div>
        <div className="kpi-card"><div className="kpi-label">Due within 7 days</div><div className="kpi-value" style={{ color: dueSoonItems.length ? 'var(--warn)' : 'var(--good)' }}>{dueSoonItems.length}</div></div>
      </div>

      {(overdueItems.length > 0 || dueSoonItems.length > 0) && (
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <div style={{ marginBottom: 10, fontWeight: 700, fontSize: '0.9375rem' }}>
            Urgent — overdue &amp; due-soon issues
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Flag</th><th>Facility</th><th>State</th><th>Gap</th><th>Assessor</th><th>Responsible person</th><th>Due date</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {[...overdueItems, ...dueSoonItems].map(i => (
                  <tr key={i.id} style={{ background: i._flag === 'Overdue' ? '#fff5f5' : '#fffbf0' }}>
                    <td>{dueFlagBadge(i._flag)}</td>
                    <td style={{ fontWeight: 600 }}>{i.facility || '—'}</td>
                    <td>{i.state || '—'}</td>
                    <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.8rem' }} title={i.gap}>{i.gap || '—'}</td>
                    <td style={{ fontSize: '0.8rem' }}>{i.assessor || '—'}</td>
                    <td style={{ fontSize: '0.8rem' }}>{i.responsiblePerson || '—'}</td>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '0.8rem', fontWeight: 700 }}>{i.dueDate || '—'}</td>
                    <td>{statusBadge(i.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {loading && <div className="alert alert-info" style={{ marginBottom: '1rem' }}>Loading…</div>}
      <div className="table-wrap" style={{ marginBottom: '1.5rem' }}>
        <table>
          <thead>
            <tr>
              <th>#</th><th>Date</th><th>Facility</th><th>State</th>
              <th>Thematic area</th><th>Gap</th>
              <th>Assessor</th><th>Responsible person</th><th>Due date</th><th>Flag</th><th>Status</th><th></th>
            </tr>
          </thead>
          <tbody>
            {annotated.length === 0 ? (
              <tr><td colSpan={12} style={{ textAlign: 'center', color: 'var(--muted)', padding: '1rem' }}>No mismatch resolutions or issues logged yet.</td></tr>
            ) : annotated.map((issue, idx) => (
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
                <td>
                  {editId === issue.id ? (
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      <select value={editStatus} onChange={e => setEditStatus(e.target.value)} style={{ padding: '3px 6px', fontSize: '0.75rem', width: 'auto' }}>
                        {HQ_ISSUE_STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
                      </select>
                      <button className="btn btn-primary btn-sm" onClick={() => updateStatus(issue)} disabled={saving}>✓</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditId(null)}>✕</button>
                    </div>
                  ) : (
                    <span onClick={() => { setEditId(issue.id); setEditStatus(issue.status) }} style={{ cursor: 'pointer' }}>
                      {statusBadge(issue.status)}
                    </span>
                  )}
                </td>
                <td>
                  {issue.source === 'manual' ? (
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--bad)' }} onClick={() => deleteIssue(issue)}>Del</button>
                  ) : (
                    <span className="badge badge-muted" title="From validation resolution">Validation</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ marginBottom: 10, fontWeight: 700, fontSize: '0.9375rem' }}>Facility action summary</div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Facility</th>
                <th style={{ textAlign: 'right' }}>Total issues</th>
                <th style={{ textAlign: 'right' }}>Open</th>
                <th style={{ textAlign: 'right' }}>Resolved</th>
                <th style={{ textAlign: 'right' }}>Resolution rate</th>
                <th style={{ textAlign: 'right' }}>Overdue</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(byFacility).length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: '1rem' }}>No data yet.</td></tr>
              ) : Object.entries(byFacility).sort((a, b) => b[1].overdue - a[1].overdue || b[1].open - a[1].open).map(([fac, d]) => (
                <tr key={fac} style={{ background: d.overdue > 0 ? '#fff8f8' : undefined }}>
                  <td style={{ fontWeight: 600 }}>{fac}</td>
                  <td style={{ textAlign: 'right' }}>{d.total}</td>
                  <td style={{ textAlign: 'right', color: d.open > 0 ? 'var(--warn)' : undefined }}>{d.open || '—'}</td>
                  <td style={{ textAlign: 'right', color: 'var(--good)' }}>{d.resolved || '—'}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>
                    {d.total > 0 ? Math.round(d.resolved / d.total * 100) + '%' : '—'}
                  </td>
                  <td style={{ textAlign: 'right', color: d.overdue > 0 ? 'var(--bad)' : undefined, fontWeight: d.overdue > 0 ? 700 : undefined }}>
                    {d.overdue > 0 ? d.overdue : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div style={{ marginBottom: 10, fontWeight: 700, fontSize: '0.9375rem' }}>Assessor accountability matrix</div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Assessor</th>
                <th style={{ textAlign: 'right' }}>Total issues</th>
                <th style={{ textAlign: 'right' }}>Resolved</th>
                <th style={{ textAlign: 'right' }}>Resolution rate</th>
                <th style={{ textAlign: 'right' }}>Overdue</th>
                <th style={{ textAlign: 'right' }}>Due soon</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(byPerson).length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: '1rem' }}>No issues logged yet.</td></tr>
              ) : Object.entries(byPerson).sort((a, b) => b[1].overdue - a[1].overdue || b[1].issues - a[1].issues).map(([person, d]) => (
                <tr key={person}>
                  <td style={{ fontWeight: 600 }}>{person}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>{d.issues}</td>
                  <td style={{ textAlign: 'right', color: 'var(--good)' }}>{d.resolved || '—'}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>
                    {d.issues > 0 ? Math.round(d.resolved / d.issues * 100) + '%' : '—'}
                  </td>
                  <td style={{ textAlign: 'right', color: d.overdue > 0 ? 'var(--bad)' : undefined, fontWeight: d.overdue > 0 ? 700 : undefined }}>
                    {d.overdue > 0 ? d.overdue : '—'}
                  </td>
                  <td style={{ textAlign: 'right', color: d.dueSoon > 0 ? 'var(--warn)' : undefined }}>
                    {d.dueSoon > 0 ? d.dueSoon : '—'}
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
