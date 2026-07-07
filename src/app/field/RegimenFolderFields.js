'use client'
import { useMemo } from 'react'
import {
  REGIMEN_LINE_OPTIONS,
  findRegimenByValue,
  formatRegimen,
  regimensForLine,
  resolveRegimenLineSelectValue,
  resolveRegimenSelectValue,
} from '@/lib/regimen-list'
import { compareTxField } from '@/lib/dqa-entry'
import FolderSelect from './FolderSelect'
import EntryBadge from './EntryBadge'

export default function RegimenFolderFields({
  lineValue,
  regimenValue,
  onLineChange,
  onRegimenChange,
  selectedTx,
  folderValues,
  disabled = false,
}) {
  const displayLine = resolveRegimenLineSelectValue(lineValue, regimenValue)
  const displayRegimen = resolveRegimenSelectValue(regimenValue)
  const folder = folderValues || { folderRegLine: lineValue, folderRegStart: regimenValue }
  const regimenLineMatch = selectedTx ? compareTxField('regimenLineAtArtStart', selectedTx, folder) : ''
  const regimenMatch = selectedTx ? compareTxField('regimenAtArtStart', selectedTx, folder) : ''

  const lineOptions = useMemo(() => {
    const opts = [...REGIMEN_LINE_OPTIONS]
    if (displayLine && !opts.includes(displayLine)) opts.unshift(displayLine)
    return opts
  }, [displayLine])

  const regimenOptions = useMemo(() => {
    return regimensForLine(displayLine).map(r => ({
      value: r.label,
      label: r.label || formatRegimen(r),
    }))
  }, [displayLine])

  function handleLineChange(nextLine) {
    onLineChange(nextLine)
    const match = findRegimenByValue(displayRegimen)
    if (displayRegimen && match && match.line !== nextLine) {
      onRegimenChange('')
    }
  }

  function handleRegimenChange(nextRegimen) {
    onRegimenChange(nextRegimen)
    const match = findRegimenByValue(nextRegimen)
    if (match?.line) onLineChange(match.line)
  }

  return (
    <>
      <div>
        <FolderSelect
          label="Regimen line at ART start (Folder)"
          value={displayLine}
          onChange={handleLineChange}
          options={lineOptions}
          placeholder="Select regimen line"
          disabled={disabled}
        />
        {regimenLineMatch ? (
          <div style={{ marginTop: 6 }}><EntryBadge text={regimenLineMatch} /></div>
        ) : null}
      </div>
      <div>
        <FolderSelect
          label="Regimen at ART start (Folder)"
          value={displayRegimen}
          onChange={handleRegimenChange}
          options={regimenOptions}
          placeholder={displayLine ? 'Select regimen' : 'Select regimen line first'}
          disabled={disabled || !displayLine}
        />
        {regimenMatch ? (
          <div style={{ marginTop: 6 }}><EntryBadge text={regimenMatch} /></div>
        ) : null}
      </div>
    </>
  )
}
