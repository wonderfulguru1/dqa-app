import { TX_FIELDS } from './dqa-entry'
import {
  isResolutionComplete,
  normalizeResolutionMap,
  normalizeSingleResolution,
  parseStoredMismatchResolutions,
} from './mismatch-resolution'

const TX_VALUE_KEYS = {
  sex: { emr: 'emrSex', folder: 'folderSex' },
  ageatstartofart: { emr: 'emrAge', folder: 'folderAge' },
  artStartDate: { emr: 'emrArtStartDate', folder: 'folderArtStartDate' },
  regimenLineAtArtStart: { emr: 'emrRegimenLine', folder: 'folderRegimenLine' },
  regimenAtArtStart: { emr: 'emrRegimen', folder: 'folderRegimen' },
  pharmacyLastPickupdate: { emr: 'emrPharmacyPickup', folder: 'folderPharmacyPickup' },
  daysOfArvRefill: { emr: 'emrDaysRefill', folder: 'folderDaysRefill' },
  currentTbStatus: { emr: 'emrTbStatus', folder: 'folderTbStatus' },
  currentPregnancyStatus: { emr: 'emrPregnancy', folder: 'folderPregnancy' },
}

function matchesFacilityFilters(record, { facilityName, state, period } = {}) {
  if (facilityName && String(record.facilityName || '').trim() !== String(facilityName).trim()) return false
  if (state && String(record.state || '').trim() !== String(state).trim()) return false
  if (period && String(record.period || '').trim() !== String(period).trim()) return false
  return true
}

function txFieldLabel(fieldKey) {
  return TX_FIELDS.find(f => f.key === fieldKey)?.label || fieldKey
}

function txFieldValues(record, fieldKey) {
  const keys = TX_VALUE_KEYS[fieldKey]
  if (!keys) return { emr: '—', folder: '—' }
  return {
    emr: record[keys.emr] != null && record[keys.emr] !== '' ? String(record[keys.emr]) : '—',
    folder: record[keys.folder] != null && record[keys.folder] !== '' ? String(record[keys.folder]) : '—',
  }
}

export function collectTxValidationIssues(txRecords, filters = {}) {
  if (!Array.isArray(txRecords)) return []
  const rows = []
  for (const record of txRecords) {
    if (!matchesFacilityFilters(record, filters)) continue
    const resolutions = parseStoredMismatchResolutions(record)
    for (const [fieldKey, resolution] of Object.entries(resolutions)) {
      if (!isResolutionComplete(resolution)) continue
      const { emr, folder } = txFieldValues(record, fieldKey)
      rows.push({
        id: `tx-${record.id}-${fieldKey}`,
        source: 'tx',
        validationId: record.id,
        fieldKey,
        label: txFieldLabel(fieldKey),
        facilityName: record.facilityName,
        period: record.period,
        state: record.state,
        lga: record.lga,
        datimCode: record.datimCode,
        thematicArea: 'ART',
        assessor: record.assessor,
        assessmentDate: record.assessmentDate,
        clientLabel: record.pepId || record.patientId || '',
        emrValue: emr,
        folderValue: folder,
        resolution,
        parentRecord: record,
      })
    }
  }
  return rows.sort((a, b) => {
    const client = a.clientLabel.localeCompare(b.clientLabel)
    if (client !== 0) return client
    return a.label.localeCompare(b.label)
  })
}

export function collectAggValidationIssues(aggRecords, filters = {}) {
  if (!Array.isArray(aggRecords)) return []
  const rows = []
  for (const record of aggRecords) {
    if (!matchesFacilityFilters(record, filters)) continue
    const resolution = normalizeSingleResolution(record.mismatchResolution)
    if (!isResolutionComplete(resolution)) continue
    rows.push({
      id: `agg-${record.id}`,
      source: 'agg',
      validationId: record.id,
      indicator: record.indicator,
      label: record.indicator,
      facilityName: record.facilityName,
      period: record.period,
      state: record.state,
      lga: record.lga,
      datimCode: record.datimCode,
      thematicArea: record.indicator,
      assessor: record.assessor,
      assessmentDate: record.assessmentDate,
      classification: record.classification,
      emrValue: record.reported != null ? String(record.reported) : '—',
      folderValue: record.validated != null ? String(record.validated) : '—',
      resolution,
      parentRecord: record,
    })
  }
  return rows.sort((a, b) => a.label.localeCompare(b.label))
}

export function uniqueValidationFacilities(txRecords, aggRecords, state) {
  const names = new Set()
  for (const record of [...(txRecords || []), ...(aggRecords || [])]) {
    if (state && record.state !== state) continue
    const name = String(record.facilityName || '').trim()
    if (name) names.add(name)
  }
  return [...names].sort()
}

export function applyTxIssueResolution(record, fieldKey, resolution) {
  const resolutions = parseStoredMismatchResolutions(record)
  resolutions[fieldKey] = resolution
  return {
    ...record,
    mismatchResolutions: normalizeResolutionMap(resolutions),
  }
}

export function applyAggIssueResolution(record, resolution) {
  return {
    ...record,
    mismatchResolution: normalizeSingleResolution(resolution),
  }
}
