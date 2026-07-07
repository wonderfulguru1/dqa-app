'use client'
import { useMemo } from 'react'

/**
 * Reliable native select for folder fields — keeps value in sync with options.
 */
export default function FolderSelect({
  label,
  value,
  onChange,
  options,
  placeholder = 'Select…',
  disabled = false,
  title = '',
}) {
  const current = String(value ?? '').trim()

  const selectOptions = useMemo(() => {
    const list = (options || []).map(opt =>
      typeof opt === 'string' ? { value: opt, label: opt } : opt,
    )
    if (current && !list.some(o => o.value === current)) {
      return [{ value: current, label: current }, ...list]
    }
    return list
  }, [options, current])

  const selectValue = current && selectOptions.some(o => o.value === current) ? current : ''

  return (
    <div className="folder-field">
      <label>{label}</label>
      <select
        className="folder-select"
        value={selectValue}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        title={title || undefined}
      >
        <option value="">{placeholder}</option>
        {selectOptions.map((opt, i) => (
          <option key={`${opt.value}-${i}`} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  )
}
