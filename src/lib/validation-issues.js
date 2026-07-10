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

export const HQ_ISSUE_STATUS_OPTIONS = ['Pending', 'Ongoing', 'Completed', 'In Progress', 'Resolved', 'Escalated']

export function resolutionStatusToHqStatus(status) {
  const map = {
    Pending: 'Pending',
    Ongoing: 'Ongoing',
    Completed: 'Completed',
    'In Progress': 'Ongoing',
    Resolved: 'Completed',
  }
  return map[String(status || '').trim()] || String(status || '').trim() || 'Pending'
}

export function hqStatusToResolutionStatus(status) {
  const map = {
    Pending: 'Pending',
    Ongoing: 'Ongoing',
    Completed: 'Completed',
    'In Progress': 'Ongoing',
    Resolved: 'Completed',
    Escalated: 'Ongoing',
  }
  return map[String(status || '').trim()] || 'Pending'
}

export function isHqIssueResolved(status) {
  return status === 'Resolved' || status === 'Completed'
}

function issueDueFlag(dueDate, status) {
  if (isHqIssueResolved(status)) return 'Completed'
  if (!dueDate) return 'Pending'
  const diff = (new Date(dueDate) - new Date()) / 86400000
  if (diff < 0) return 'Overdue'
  if (diff <= 7) return 'Due soon'
  return 'On track'
}

export function formatResponsiblePersons(value) {
  return String(value || '')
    .split(/[,;\n]+/)
    .map(s => s.trim())
    .filter(Boolean)
    .join(', ')
}

/** Assessor name from the saved TX/Agg validation (entry form field). */
export function getValidationAssessor(record) {
  return String(record?.assessor || '').trim()
}

/** Assessor for an issue row — TX/Agg always use the parent validation assessor. */
export function getIssueAssessor(issue) {
  if (issue?.source === 'tx' || issue?.source === 'agg') {
    return getValidationAssessor(issue?.parentRecord) || String(issue?.assessor || '').trim()
  }
  return String(
    issue?.assessor
    || issue?._manualRecord?.assessor
    || '',
  ).trim()
}

export function collectAllValidationIssues(txRecords, aggRecords, filters = {}) {
  return [
    ...collectTxValidationIssues(txRecords, filters),
    ...collectAggValidationIssues(aggRecords, filters),
  ]
}

/** Total issues per assessor from the same rows shown in the issues register. */
export function buildAssessorAccountabilityMatrix(issueRows = []) {
  const byPerson = {}

  function ensure(assessor) {
    const key = assessor || 'Unassigned'
    if (!byPerson[key]) {
      byPerson[key] = { issues: 0, resolved: 0, overdue: 0, dueSoon: 0 }
    }
    return key
  }

  for (const issue of issueRows) {
    const assessor = getIssueAssessor(issue)
    const key = ensure(assessor)
    byPerson[key].issues++
    const flag = issue._flag || issueDueFlag(issue.dueDate, issue.status)
    if (isHqIssueResolved(issue.status)) byPerson[key].resolved++
    if (flag === 'Overdue') byPerson[key].overdue++
    if (flag === 'Due soon') byPerson[key].dueSoon++
  }

  return byPerson
}

export function validationIssueToHqRow(issue) {
  const res = issue.resolution || {}
  const assessor = getIssueAssessor({ ...issue, source: issue.source, parentRecord: issue.parentRecord })
  return {
    id: issue.id,
    source: issue.source,
    validationId: issue.validationId,
    fieldKey: issue.fieldKey,
    parentRecord: issue.parentRecord,
    date: issue.assessmentDate || '',
    facility: issue.facilityName || '',
    state: issue.state || '',
    period: issue.period || '',
    thematicArea: issue.thematicArea || issue.label || '',
    gap: res.gap || '',
    proposedSolution: res.proposedSolution || '',
    responsiblePerson: formatResponsiblePersons(res.otherComments),
    dueDate: res.dueDate || '',
    status: resolutionStatusToHqStatus(res.status),
    assessor,
  }
}

export function manualIssueToHqRow(issue) {
  const assessor = getIssueAssessor({ assessor: issue.assessor, _manualRecord: issue })
  return {
    id: issue.id,
    source: 'manual',
    date: issue.date || issue.identifiedDate || '',
    facility: issue.facility || '',
    state: issue.state || '',
    period: issue.period || '',
    thematicArea: issue.thematicArea || '',
    gap: issue.gap || '',
    proposedSolution: issue.proposedSolution || '',
    responsiblePerson: formatResponsiblePersons(issue.responsiblePerson),
    dueDate: issue.dueDate || '',
    status: issue.status || 'Pending',
    assessor,
    _manualRecord: issue,
  }
}
