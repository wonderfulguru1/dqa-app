'use client'
import EntryBadge from './EntryBadge'

export default function ConcurrencePreviewTable({
  rows,
  valueHeaders = ['EMR', 'Folder'],
  resolutions = {},
  onResolve,
}) {
  if (!rows?.length) return null

  const mismatches = rows.filter(r => r.isMismatch)

  return (
    <div className="save-preview-section">
      <h4>Element concurrence</h4>
      {mismatches.length > 0 ? (
        <p className="save-preview-note warn">
          {mismatches.length} mismatch{mismatches.length !== 1 ? 'es' : ''} found.
          Use <strong>Resolve</strong> on each row before confirming save.
        </p>
      ) : (
        <p className="save-preview-note good">All comparable fields match. You can confirm and save.</p>
      )}
      <div className="save-preview-table-wrap">
        <table className="save-preview-table">
          <thead>
            <tr>
              <th>Field</th>
              <th>{valueHeaders[0]}</th>
              <th>{valueHeaders[1]}</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.key} className={row.isMismatch ? 'concurrence-row-mismatch' : ''}>
                <td style={{ fontWeight: 600 }}>{row.label}</td>
                <td>{row.emr}</td>
                <td>{row.folder}</td>
                <td><EntryBadge text={row.status} /></td>
                <td>
                  {row.isMismatch ? (
                    <button
                      type="button"
                      className="entry-btn secondary save-preview-resolve-btn"
                      onClick={() => onResolve(row)}
                    >
                      {resolutions[row.key] ? 'Edit resolution' : 'Resolve'}
                    </button>
                  ) : (
                    <span className="muted small">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
