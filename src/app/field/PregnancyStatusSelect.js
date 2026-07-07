'use client'
import { useMemo } from 'react'
import {
  PREGNANCY_STATUS_OPTIONS,
  formatPregnancyStatus,
  resolvePregnancyStatusSelectValue,
} from '@/lib/pregnancy-status-list'
import FolderSelect from './FolderSelect'

export default function PregnancyStatusSelect({ value, onChange, disabled = false }) {
  const displayValue = resolvePregnancyStatusSelectValue(value)

  const options = useMemo(() => (
    PREGNANCY_STATUS_OPTIONS.map(opt => ({
      value: opt.label,
      label: formatPregnancyStatus(opt),
    }))
  ), [])

  return (
    <FolderSelect
      label="Pregnancy / Breastfeeding status (Folder)"
      value={displayValue}
      onChange={onChange}
      options={options}
      placeholder="Select status"
      disabled={disabled}
      title={disabled ? 'Not editable when Sex (Folder) is M' : ''}
    />
  )
}
