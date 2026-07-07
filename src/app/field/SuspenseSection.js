'use client'
import FieldSectionSkeleton from './FieldSectionSkeleton'

export default function SuspenseSection({
  pending,
  children,
  fallback,
  rows = 3,
}) {
  if (pending) {
    return fallback || <FieldSectionSkeleton rows={rows} />
  }
  return children
}
