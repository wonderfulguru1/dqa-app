'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import FieldSideNav from '../field/FieldSideNav'
import HqCallout from './HqCallout'
import { canAccessDataManagement } from '@/lib/roles'

const HQ_NAV = [
  { href: '/hq/overview', label: 'Overview' },
  { href: '/hq/tx', label: 'TX_NEW Client-Level' },
  { href: '/hq/agg', label: 'Aggregate Concurrence' },
  { href: '/hq/summary', label: 'HQ Summary' },
  { href: '/hq/brief', label: 'State Out-Brief' },
  { href: '/hq/cmp', label: 'CMP Tracker' },
  { href: '/hq/issues', label: 'Issues & Accountability' },
  { href: '/hq/manage', label: 'Data Management', manageOnly: true },
]

export default function HqShell({ session, children }) {
  const pathname = usePathname()
  const router = useRouter()
  const navItems = HQ_NAV.filter(t => !t.manageOnly || canAccessDataManagement(session.role))

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.replace('/login')
  }

  return (
    <div className="shell hq-shell">
      <header className="topbar">
        <span className="topbar-brand">ECEWS DQA Companion — HQ Dashboard</span>
        <div className="topbar-right">
          <span>{session.name}</span>
          {session.state && <span style={{ opacity: 0.7 }}>{session.state}</span>}
          <button
            onClick={logout}
            className="btn btn-ghost btn-sm"
            style={{ color: 'rgba(255,255,255,0.85)', borderColor: 'rgba(255,255,255,0.3)' }}
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="hq-body">
        <aside className="hq-sidebar">
          <div className="hq-sidebar-brand">HQ Navigation</div>
          <nav className="hq-sidebar-nav">
            {navItems.map(t => (
              <Link
                key={t.href}
                href={t.href}
                className={`hq-sidebar-link ${pathname.startsWith(t.href) ? 'active' : ''}`}
              >
                {t.label}
              </Link>
            ))}
          </nav>

          <div className="hq-sidebar-section">
            <div className="hq-sidebar-brand">Field Entry</div>
            <FieldSideNav basePath="/hq/field" />
          </div>
        </aside>

        <main className="page-content hq-main">
          <HqCallout />
          {children}
        </main>
      </div>
    </div>
  )
}
