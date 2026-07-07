'use client'
import { useState, useEffect, useRef } from 'react'

function Section({ title, children }) {
  return (
    <div className="section">
      <h2 className="section-title">{title}</h2>
      <div className="card">{children}</div>
    </div>
  )
}

export default function ManagePage() {
  const [tab, setTab] = useState('preloads')
  const [preloads, setPreloads] = useState([])
  const [users, setUsers] = useState([])
  const [msg, setMsg] = useState(null)
  const [loading, setLoading] = useState(false)

  // Upload state
  const [upFile, setUpFile] = useState(null)
  const [upType, setUpType] = useState('tx')
  const [upPeriod, setUpPeriod] = useState('')
  const [upState, setUpState] = useState('')
  const fileInputRef = useRef(null)

  // New user state
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'field', state: '' })

  // Reset state
  const [resetPeriod, setResetPeriod] = useState('')
  const [resetState, setResetState] = useState('')
  const [resetType, setResetType] = useState('tx')

  useEffect(() => {
    loadPreloads()
    loadUsers()
  }, [])

  async function loadPreloads() {
    const data = await fetch('/api/preloads').then(r => r.json())
    setPreloads(Array.isArray(data) ? data : [])
  }

  async function loadUsers() {
    const data = await fetch('/api/users').then(r => r.json())
    setUsers(Array.isArray(data) ? data : [])
  }

  function showMsg(type, text) {
    setMsg({ type, text })
    setTimeout(() => setMsg(null), 4000)
  }

  async function handleUpload(e) {
    e.preventDefault()
    if (!upFile) { showMsg('error', 'Please select a file.'); return }
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('file', upFile)
      fd.append('type', upType)
      if (upPeriod) fd.append('period', upPeriod)
      if (upState) fd.append('state', upState)
      const r = await fetch('/api/preloads', { method: 'POST', body: fd })
      if (!r.ok) { const d = await r.json(); throw new Error(d.error || 'Upload failed'); }
      const p = await r.json()
      showMsg('success', `Preload uploaded (${p.id}) — ${upType.toUpperCase()} · ${upPeriod || 'no period'} · ${upState || 'all states'}`)
      setUpFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      await loadPreloads()
    } catch (err) {
      showMsg('error', err.message)
    } finally {
      setLoading(false)
    }
  }

  async function toggleLock(p) {
    await fetch(`/api/preloads/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locked: !p.locked }),
    })
    await loadPreloads()
    showMsg('success', `Preload ${!p.locked ? 'locked' : 'unlocked'}.`)
  }

  async function deletePreload(p) {
    if (!confirm(`Delete preload #${p.id} (${p.type} · ${p.period || 'no period'})? This cannot be undone.`)) return
    await fetch(`/api/preloads/${p.id}`, { method: 'DELETE' })
    await loadPreloads()
    showMsg('success', 'Preload deleted.')
  }

  async function handleCreateUser(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const r = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser),
      })
      if (!r.ok) { const d = await r.json(); throw new Error(d.error || 'Failed'); }
      showMsg('success', `User "${newUser.name}" created.`)
      setNewUser({ name: '', email: '', password: '', role: 'field', state: '' })
      await loadUsers()
    } catch (err) {
      showMsg('error', err.message)
    } finally {
      setLoading(false)
    }
  }

  async function deleteUser(u) {
    if (!confirm(`Delete user ${u.name} (${u.email})?`)) return
    await fetch(`/api/users?id=${u.id}`, { method: 'DELETE' })
    await loadUsers()
    showMsg('success', 'User deleted.')
  }

  async function handleReset(e) {
    e.preventDefault()
    const target = resetType === 'tx' ? 'TX_NEW validation' : resetType === 'agg' ? 'aggregate' : 'issues'
    if (!confirm(`DELETE ALL ${target} data${resetPeriod ? ` for period ${resetPeriod}` : ''}${resetState ? ` in ${resetState} state` : ''}? This CANNOT be undone!`)) return
    setLoading(true)
    try {
      const qp = new URLSearchParams()
      if (resetPeriod) qp.set('period', resetPeriod)
      if (resetState) qp.set('state', resetState)
      const endpoint = resetType === 'tx' ? '/api/tx' : resetType === 'agg' ? '/api/agg' : '/api/issues'
      const r = await fetch(`${endpoint}?${qp}`, { method: 'DELETE' })
      const d = await r.json()
      showMsg('success', `Deleted ${d.deleted} record(s).`)
    } catch {
      showMsg('error', 'Reset failed.')
    } finally {
      setLoading(false)
    }
  }

  const tabStyle = (t) => ({
    padding: '8px 16px',
    cursor: 'pointer',
    borderBottom: tab === t ? '2px solid var(--g1)' : '2px solid transparent',
    color: tab === t ? 'var(--g1)' : 'var(--muted)',
    fontWeight: tab === t ? 700 : 500,
    fontSize: '0.8125rem',
    background: 'none',
    border: 'none',
    borderBottomWidth: 2,
    borderBottomStyle: 'solid',
    borderBottomColor: tab === t ? 'var(--g1)' : 'transparent',
    fontFamily: 'inherit',
  })

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Data Management</h1>
      </div>

      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      {/* Tab switcher */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--line)', marginBottom: '1.5rem' }}>
        <button style={tabStyle('preloads')} onClick={() => setTab('preloads')}>Preload Management</button>
        <button style={tabStyle('users')} onClick={() => setTab('users')}>User Management</button>
        <button style={tabStyle('reset')} onClick={() => setTab('reset')}>Data Reset</button>
      </div>

      {tab === 'preloads' && (
        <>
          <Section title="Upload Preload (Excel / CSV)">
            <form onSubmit={handleUpload}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
                <div className="form-field">
                  <label>Preload Type</label>
                  <select value={upType} onChange={e => setUpType(e.target.value)}>
                    <option value="tx">TX_NEW (EMR Line List)</option>
                    <option value="agg">Aggregate (DHIS Extract)</option>
                  </select>
                </div>
                <div className="form-field">
                  <label>Period (optional)</label>
                  <input value={upPeriod} onChange={e => setUpPeriod(e.target.value)} placeholder="e.g. 2025Q4" />
                </div>
                <div className="form-field">
                  <label>State (optional)</label>
                  <input value={upState} onChange={e => setUpState(e.target.value)} placeholder="e.g. Akwa Ibom" />
                </div>
                <div className="form-field">
                  <label>File (.xlsx, .xls, .csv)</label>
                  <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={e => setUpFile(e.target.files[0])} />
                </div>
              </div>
              <button type="submit" className="btn btn-primary" disabled={loading || !upFile}>
                {loading ? 'Uploading…' : 'Upload Preload'}
              </button>
            </form>

            <div className="alert alert-info" style={{ marginTop: '1rem' }}>
              <strong>TX preload columns expected:</strong> Patient ID, PEP ID, Facility Name, LGA, State, Period, Sex, Age, ART Start Date, Regimen Line, Regimen, Last Pharmacy Pickup, Days of ARV Refill, TB Status, Pregnancy Status
              <br />
              <strong>Aggregate preload:</strong> Use long format (Facility Name, Indicator, Reported Value) or wide format with "(Reported)" column headers.
            </div>
          </Section>

          <Section title="Preload List">
            {preloads.length === 0 ? <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>No preloads uploaded yet.</p> : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Type</th>
                      <th>Period</th>
                      <th>State</th>
                      <th>Uploaded By</th>
                      <th>Date</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preloads.map(p => (
                      <tr key={p.id}>
                        <td style={{ fontFamily: 'monospace' }}>#{p.id}</td>
                        <td><span className={`badge badge-${p.type === 'tx' ? 'good' : 'info'}`}>{p.type.toUpperCase()}</span></td>
                        <td>{p.period || '—'}</td>
                        <td>{p.state || 'All'}</td>
                        <td>{p.uploadedBy}</td>
                        <td style={{ fontSize: '0.75rem' }}>{new Date(p.createdAt).toLocaleDateString()}</td>
                        <td>
                          {p.locked
                            ? <span className="badge badge-good">Locked</span>
                            : <span className="badge badge-muted">Unlocked</span>}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className={`btn btn-sm ${p.locked ? 'btn-secondary' : 'btn-primary'}`} onClick={() => toggleLock(p)}>
                              {p.locked ? 'Unlock' : 'Lock'}
                            </button>
                            <button className="btn btn-sm btn-danger" onClick={() => deletePreload(p)}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </>
      )}

      {tab === 'users' && (
        <>
          <Section title="Create New User">
            <form onSubmit={handleCreateUser}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
                <div className="form-field">
                  <label>Full Name</label>
                  <input value={newUser.name} onChange={e => setNewUser(u => ({ ...u, name: e.target.value }))} required />
                </div>
                <div className="form-field">
                  <label>Email</label>
                  <input type="email" value={newUser.email} onChange={e => setNewUser(u => ({ ...u, email: e.target.value }))} required />
                </div>
                <div className="form-field">
                  <label>Password</label>
                  <input type="password" value={newUser.password} onChange={e => setNewUser(u => ({ ...u, password: e.target.value }))} required minLength={8} />
                </div>
                <div className="form-field">
                  <label>Role</label>
                  <select value={newUser.role} onChange={e => setNewUser(u => ({ ...u, role: e.target.value }))}>
                    <option value="field">Field</option>
                    <option value="hq">HQ</option>
                  </select>
                </div>
                <div className="form-field">
                  <label>State (for field users)</label>
                  <input value={newUser.state} onChange={e => setNewUser(u => ({ ...u, state: e.target.value }))} placeholder="e.g. Akwa Ibom" />
                </div>
              </div>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Creating…' : 'Create User'}
              </button>
            </form>
          </Section>

          <Section title="All Users">
            {users.length === 0 ? <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>No users found.</p> : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>State</th>
                      <th>Created</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id}>
                        <td style={{ fontWeight: 600 }}>{u.name}</td>
                        <td style={{ fontSize: '0.8rem' }}>{u.email}</td>
                        <td><span className={`badge badge-${u.role === 'hq' ? 'good' : 'info'}`}>{u.role}</span></td>
                        <td>{u.state || '—'}</td>
                        <td style={{ fontSize: '0.75rem' }}>{new Date(u.createdAt).toLocaleDateString()}</td>
                        <td>
                          <button className="btn btn-sm btn-danger" onClick={() => deleteUser(u)}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </>
      )}

      {tab === 'reset' && (
        <Section title="Reset / Delete Assessment Data">
          <div className="alert alert-warn" style={{ marginBottom: '1rem' }}>
            <strong>Warning:</strong> This will permanently delete records. Use only to clear test data or reset for a new assessment cycle.
          </div>
          <form onSubmit={handleReset}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1rem' }}>
              <div className="form-field">
                <label>Data Type</label>
                <select value={resetType} onChange={e => setResetType(e.target.value)}>
                  <option value="tx">TX_NEW Validations</option>
                  <option value="agg">Aggregate Validations</option>
                  <option value="issues">Issues</option>
                </select>
              </div>
              <div className="form-field">
                <label>Period (leave blank for ALL)</label>
                <input value={resetPeriod} onChange={e => setResetPeriod(e.target.value)} placeholder="e.g. 2025Q4" />
              </div>
              <div className="form-field">
                <label>State (leave blank for ALL)</label>
                <input value={resetState} onChange={e => setResetState(e.target.value)} placeholder="e.g. Akwa Ibom" />
              </div>
            </div>
            <button type="submit" className="btn btn-danger" disabled={loading}>
              {loading ? 'Deleting…' : 'Delete Records'}
            </button>
          </form>
        </Section>
      )}
    </>
  )
}
