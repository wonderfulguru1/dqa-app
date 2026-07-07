'use client'
import { EMPTY_MISMATCH_RESOLUTION } from '@/lib/mismatch-resolution'

export default function MismatchResolutionModal({
  open,
  fieldLabel,
  emrValue,
  folderValue,
  valueLabels = ['EMR', 'Folder'],
  resolution,
  onChange,
  onClose,
  onSave,
  saving = false,
}) {
  if (!open) return null

  const form = resolution || EMPTY_MISMATCH_RESOLUTION

  return (
    <div className="save-preview-overlay mismatch-resolution-overlay" onClick={onClose} role="presentation">
      <div
        className="save-preview-modal mismatch-resolution-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mismatch-resolution-title"
        onClick={e => e.stopPropagation()}
      >
        <div className="save-preview-header">
          <h3 id="mismatch-resolution-title">Resolve mismatch — {fieldLabel}</h3>
          <p>Document the gap and proposed resolution for this field before saving.</p>
        </div>
        <div className="mismatch-resolution-context">
          <div><strong>{valueLabels[0]}:</strong> {emrValue || '—'}</div>
          <div><strong>{valueLabels[1]}:</strong> {folderValue || '—'}</div>
        </div>
        <div className="save-preview-body mismatch-resolution-body">
          <div className="grid2">
            <div className="entry-card">
              <label className="label-required">Issues/gaps</label>
              <textarea
                value={form.gap}
                onChange={e => onChange({ ...form, gap: e.target.value })}
              />
            </div>
            <div className="entry-card">
              <label>Why does this gap exist?</label>
              <textarea
                value={form.whyGapExists}
                onChange={e => onChange({ ...form, whyGapExists: e.target.value })}
              />
            </div>
            <div className="entry-card">
              <label>Proposed solution</label>
              <textarea
                value={form.proposedSolution}
                onChange={e => onChange({ ...form, proposedSolution: e.target.value })}
              />
            </div>
            <div className="entry-card">
              <label>Expected result</label>
              <textarea
                value={form.expectedResult}
                onChange={e => onChange({ ...form, expectedResult: e.target.value })}
              />
            </div>
            <div className="entry-card">
              <label>Due date</label>
              <input
                type="date"
                value={form.dueDate || ''}
                onChange={e => onChange({ ...form, dueDate: e.target.value })}
              />
            </div>
            <div className="entry-card">
              <label>Required resources</label>
              <textarea
                value={form.requiredResources}
                onChange={e => onChange({ ...form, requiredResources: e.target.value })}
              />
            </div>
            <div className="entry-card">
              <label>Other Comments</label>
              <textarea
                value={form.otherComments}
                onChange={e => onChange({ ...form, otherComments: e.target.value })}
              />
            </div>
          </div>
        </div>
        <div className="save-preview-actions">
          <button type="button" className="entry-btn secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="button" className="entry-btn" onClick={onSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save resolution'}
          </button>
        </div>
      </div>
    </div>
  )
}
