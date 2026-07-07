export default function FieldRouteFallback({ label = 'Loading page…' }) {
  return (
    <div className="field-suspense-fallback" aria-busy="true" aria-live="polite">
      <p className="field-suspense-label">{label}</p>
      <div className="field-skeleton field-skeleton--card" />
      <div className="field-skeleton field-skeleton--card field-skeleton--short" />
      <div className="field-skeleton-grid">
        <div className="field-skeleton field-skeleton--block" />
        <div className="field-skeleton field-skeleton--block" />
      </div>
    </div>
  )
}
