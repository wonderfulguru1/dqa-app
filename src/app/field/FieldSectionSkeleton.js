export default function FieldSectionSkeleton({ rows = 3 }) {
  return (
    <div className="field-suspense-fallback field-suspense-fallback--inline" aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className={`field-skeleton field-skeleton--row${i === rows - 1 ? ' field-skeleton--short' : ''}`}
        />
      ))}
    </div>
  )
}
