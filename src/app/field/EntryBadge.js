'use client'
import { badgeClass } from '@/lib/dqa-entry'

export default function EntryBadge({ text }) {
  if (!text) return null
  return <span className={`entry-badge ${badgeClass(text)}`}>{text}</span>
}
