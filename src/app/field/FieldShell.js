'use client'
import { Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { FieldEntryProvider, useFieldEntry } from './FieldEntryContext'
import FieldSideNav from './FieldSideNav'
import FieldEntryChrome from './FieldEntryChrome'
import FieldRouteFallback from './FieldRouteFallback'
import './field-entry.css'

function FieldShellInner({ children }) {
  const router = useRouter()
  const {
    session,
    preloadTx,
    preloadAgg,
    txSaved,
    aggSaved,
    issuesSaved,
    preloadLocked,
  } = useFieldEntry()

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.replace('/login')
  }

  return (
    <div className="field-entry">
      <div className="hero">
        <div className="hero-top">
          <div>
            <h1>ECEWS DQA Companion Data Entry</h1>
            <p>Field teams select preloaded clients and facilities, document validated folder values or aggregate values on site, and save to the server. HQ preloads EMR line lists and DHIS aggregate data before the visit.</p>
          </div>
          <div className="hero-right">
            <span>{session?.name}</span>
            {session?.state && <span className="hero-state-badge">{session.state}</span>}
            <button type="button" className="entry-btn ghost" onClick={logout}>Sign out</button>
          </div>
        </div>
        <div className="pills">
          <div className="pill">TX preload: {preloadTx.length}</div>
          <div className="pill">Aggregate preload: {preloadAgg.length}</div>
          <div className="pill">Validated TX rows: {txSaved.length}</div>
          <div className="pill">Validated aggregate rows: {aggSaved.length}</div>
          <div className="pill">Issues: {issuesSaved.length}</div>
          <div className="pill">Preload: {preloadLocked ? 'Locked for field use' : 'Unlocked'}</div>
        </div>
      </div>

      <div className="entry-body">
        <aside className="hq-sidebar entry-sidebar">
          <div className="hq-sidebar-brand">Field Entry</div>
          <FieldSideNav basePath="/field" />
        </aside>

        <div className="entry-shell">
          <div className="entry-main">
            <FieldEntryChrome />
            <Suspense fallback={<FieldRouteFallback />}>
              {children}
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function FieldShell({ session, children }) {
  return (
    <FieldEntryProvider session={session}>
      <FieldShellInner>{children}</FieldShellInner>
    </FieldEntryProvider>
  )
}
