'use client'

const STATUS_OPTIONS = ['Pending', 'In Progress', 'Resolved', 'Escalated']

export default function IssueFormModal({
  open,
  title,
  subtitle,
  issue,
  onChange,
  onClose,
  onSave,
  saving = false,
  saveLabel = 'Save issue',
}) {
  if (!open || !issue) return null

  return (
    <div className="save-preview-overlay mismatch-resolution-overlay" onClick={onClose} role="presentation">
      <div
        className="save-preview-modal mismatch-resolution-modal issue-form-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="issue-form-title"
        onClick={e => e.stopPropagation()}
      >
        <div className="save-preview-header">
          <h3 id="issue-form-title">{title}</h3>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        <div className="save-preview-body mismatch-resolution-body">
          <div className="save-preview-section">
            <h4>Issue details</h4>
            <div className="grid4">
              <div className="entry-card">
                <label>Date</label>
                <input type="date" value={issue.date || ''} onChange={e => onChange({ ...issue, date: e.target.value })} />
              </div>
              <div className="entry-card">
                <label>Period</label>
                <input value={issue.period || ''} onChange={e => onChange({ ...issue, period: e.target.value })} />
              </div>
              <div className="entry-card">
                <label>State</label>
                <input value={issue.state || ''} onChange={e => onChange({ ...issue, state: e.target.value })} />
              </div>
              <div className="entry-card">
                <label>Facility</label>
                <input value={issue.facility || ''} onChange={e => onChange({ ...issue, facility: e.target.value })} />
              </div>
              <div className="entry-card">
                <label className="label-required">Assessor</label>
                <input
                  value={issue.assessor || ''}
                  onChange={e => onChange({ ...issue, assessor: e.target.value })}
                  placeholder="Or set in General controls above"
                />
              </div>
            </div>
            <div className="grid3 mt12">
              <div className="entry-card">
                <label>Thematic area / facility</label>
                <input value={issue.thematicArea || ''} onChange={e => onChange({ ...issue, thematicArea: e.target.value })} />
              </div>
              <div className="entry-card">
                <label>Responsible person(s)</label>
                <input value={issue.responsiblePerson || ''} onChange={e => onChange({ ...issue, responsiblePerson: e.target.value })} />
              </div>
              <div className="entry-card">
                <label>Status</label>
                <select value={issue.status || 'Pending'} onChange={e => onChange({ ...issue, status: e.target.value })}>
                  {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="entry-card">
                <label>Date issue was identified</label>
                <input type="date" value={issue.identifiedDate || ''} onChange={e => onChange({ ...issue, identifiedDate: e.target.value })} />
              </div>
              <div className="entry-card">
                <label>Timeline for closing gap</label>
                <input type="date" value={issue.dueDate || ''} onChange={e => onChange({ ...issue, dueDate: e.target.value })} />
              </div>
              <div className="entry-card">
                <label>Status date</label>
                <input type="date" value={issue.statusDate || ''} onChange={e => onChange({ ...issue, statusDate: e.target.value })} />
              </div>
            </div>
          </div>
          <div className="save-preview-section">
            <h4>Gap &amp; action plan</h4>
            <div className="grid2">
              <div className="entry-card">
                <label className="label-required">Issues/gaps</label>
                <textarea value={issue.gap || ''} onChange={e => onChange({ ...issue, gap: e.target.value })} />
              </div>
              <div className="entry-card">
                <label>Why does this gap exist?</label>
                <textarea value={issue.whyGapExists || ''} onChange={e => onChange({ ...issue, whyGapExists: e.target.value })} />
              </div>
              <div className="entry-card">
                <label>Proposed solution</label>
                <textarea value={issue.proposedSolution || ''} onChange={e => onChange({ ...issue, proposedSolution: e.target.value })} />
              </div>
              <div className="entry-card">
                <label>Expected result</label>
                <textarea value={issue.expectedResult || ''} onChange={e => onChange({ ...issue, expectedResult: e.target.value })} />
              </div>
              <div className="entry-card">
                <label>Required resources</label>
                <textarea value={issue.requiredResources || ''} onChange={e => onChange({ ...issue, requiredResources: e.target.value })} />
              </div>
              <div className="entry-card">
                <label>Other comments</label>
                <textarea value={issue.otherComments || ''} onChange={e => onChange({ ...issue, otherComments: e.target.value })} />
              </div>
            </div>
          </div>
        </div>
        <div className="save-preview-actions">
          <button type="button" className="entry-btn secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="button" className="entry-btn" onClick={onSave} disabled={saving}>
            {saving ? 'Saving…' : saveLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
