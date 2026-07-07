'use client'

function PreviewSection({ title, rows }) {
  const visible = (rows || []).filter(([, value]) => value !== '' && value !== null && value !== undefined)
  if (!visible.length) return null
  return (
    <div className="save-preview-section">
      <h4>{title}</h4>
      <dl className="save-preview-dl">
        {visible.map(([label, value]) => (
          <div key={label} className="save-preview-row">
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

export function SavePreviewSections({ sections }) {
  return (
    <>
      {sections.map(section => (
        <PreviewSection key={section.title} title={section.title} rows={section.rows} />
      ))}
    </>
  )
}

export default function SavePreviewModal({
  open,
  title,
  subtitle,
  onClose,
  onConfirm,
  confirming = false,
  confirmDisabled = false,
  confirmLabel = 'Confirm & save',
  showConfirm = true,
  children,
}) {
  if (!open) return null

  return (
    <div className="save-preview-overlay" onClick={confirming ? undefined : onClose} role="presentation">
      <div
        className="save-preview-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-preview-title"
        onClick={e => e.stopPropagation()}
      >
        <div className="save-preview-header">
          <h3 id="save-preview-title">{title}</h3>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        <div className="save-preview-body">{children}</div>
        <div className="save-preview-actions">
          <button type="button" className="entry-btn secondary" onClick={onClose} disabled={confirming}>
            Cancel
          </button>
          {showConfirm ? (
            <button
              type="button"
              className="entry-btn"
              onClick={onConfirm}
              disabled={confirming || confirmDisabled}
              title={confirmDisabled ? 'Resolve all mismatches before saving' : ''}
            >
              {confirming ? 'Saving…' : confirmLabel}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
