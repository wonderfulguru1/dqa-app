'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      })
      const data = await r.json()
      if (!r.ok) { setError(data.error || 'Login failed'); return }
      router.replace(data.role === 'hq' ? '/hq/overview' : '/field')
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-logo">DQ</div>
        <h1 style={{ textAlign: 'center', fontSize: '1.125rem', fontWeight: 700, marginBottom: 4 }}>
          ECEWS DQA Companion
        </h1>
        <p style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '1.5rem' }}>
          Sign in to continue
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-field">
            <label>Email Address</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="you@ecews.org"
            />
          </div>
          <div className="form-field">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
            />
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '10px' }}
            disabled={loading}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--muted)', marginTop: '1.5rem' }}>
          ECEWS Data Quality Assessment System
          <br />
          <a href="/docs" style={{ color: 'var(--g1)', marginTop: 6, display: 'inline-block' }}>
            API documentation
          </a>
        </p>
      </div>
    </div>
  )
}
