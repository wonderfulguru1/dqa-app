import FieldSectionSkeleton from './FieldSectionSkeleton'

export default function FieldRouteFallback({ label = 'Loading page…' }) {
  return (
    <div className="field-suspense-fallback" aria-busy="true" aria-live="polite">
      <div className="tx-scorecard-bar">
        <div className="entry-section tx-scorecard-heading">
          <h3>Validation scorecard</h3>
          <span className="muted">{label}</span>
        </div>
        <div className="grid4 tx-scorecard-grid">
          {['Folder completeness %', 'Match count', 'Concurrence %', 'EMR-only completeness %'].map(title => (
            <div key={title} className="entry-card entry-kpi">
              <div className="k">{title}</div>
              <div className="field-skeleton field-skeleton--short" style={{ marginTop: 10 }} />
            </div>
          ))}
        </div>
      </div>
      <FieldSectionSkeleton rows={6} />
    </div>
  )
}
