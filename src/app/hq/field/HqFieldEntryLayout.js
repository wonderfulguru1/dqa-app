'use client'
import { FieldEntryProvider } from '@/app/field/FieldEntryContext'
import FieldEntryChrome from '@/app/field/FieldEntryChrome'
import '@/app/field/field-entry.css'

export default function HqFieldEntryLayout({ session, children }) {
  return (
    <FieldEntryProvider session={session}>
      <div className="hq-field-entry field-entry">
        <div className="page-header">
          <h1 className="page-title">Field Data Entry</h1>
          <p className="text-muted" style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Document validated folder values and aggregate indicators on site.
          </p>
        </div>
        <FieldEntryChrome />
        {children}
      </div>
    </FieldEntryProvider>
  )
}
