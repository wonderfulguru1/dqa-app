'use client'
import { useMemo } from 'react'
import {
  TB_STATUS_OPTIONS,
  resolveTbStatusSelectValue,
} from '@/lib/tb-status-list'
import FolderSelect from './FolderSelect'

export default function TbStatusSelect({ value, onChange, disabled = false }) {
  const displayValue = resolveTbStatusSelectValue(value)

  const options = useMemo(() => (
    TB_STATUS_OPTIONS.map(opt => ({
      value: opt.label,
      label: opt.label,
    }))
  ), [])

  return (
    <FolderSelect
      label="Current TB status (Folder)"
      value={displayValue}
      onChange={onChange}
      options={options}
      placeholder="Select TB status"
      disabled={disabled}
    />
  )
}
