import {
  collectAggValidationIssues,
  collectTxValidationIssues,
  formatResponsiblePersons,
} from './validation-issues'

export const TX_THEMATIC_AREA = 'ART'

export const ISSUE_EXPORT_HEADERS = [
  'DQA Period',
  'State',
  'LGA',
  'Facility',
  'DATIM Code',
  'Field',
  'EMR',
  'Folder',
  'Thematic area',
  'Client',
  'Issues/gaps',
  'Why gap exists',
  'Proposed solution',
  'Expected result',
  'Responsible person(s)',
  'Due Date',
  'Status',
]

function displayValue(value) {
  if (value === null || value === undefined || value === '—') return ''
  return value
}

export function issueRowToExportRow(issue) {
  const res = issue?.resolution || {}
  const isTx = issue?.source === 'tx'
  return {
    'DQA Period': displayValue(issue?.period),
    'State': displayValue(issue?.state),
    'LGA': displayValue(issue?.lga),
    'Facility': displayValue(issue?.facilityName),
    'DATIM Code': displayValue(issue?.datimCode),
    'Field': displayValue(issue?.label),
    'EMR': displayValue(issue?.emrValue),
    'Folder': displayValue(issue?.folderValue),
    'Thematic area': isTx ? TX_THEMATIC_AREA : displayValue(issue?.thematicArea || issue?.indicator || issue?.label),
    'Client': isTx ? displayValue(issue?.clientLabel) : '',
    'Issues/gaps': res.gap || '',
    'Why gap exists': res.whyGapExists || '',
    'Proposed solution': res.proposedSolution || '',
    'Expected result': res.expectedResult || '',
    'Responsible person(s)': formatResponsiblePersons(res.otherComments),
    'Due Date': res.dueDate || '',
    'Status': res.status || 'Pending',
  }
}

export function txExportHeaders() {
  return [...ISSUE_EXPORT_HEADERS]
}

export function aggExportHeaders() {
  return [...ISSUE_EXPORT_HEADERS]
}

export function txRecordsToExportRows(records, filters = {}) {
  return collectTxValidationIssues(records, filters).map(issueRowToExportRow)
}

export function aggRecordsToExportRows(records, filters = {}) {
  return collectAggValidationIssues(records, filters).map(issueRowToExportRow)
}

export function csvDownloadOrdered(name, rows, headers) {
  if (!rows?.length) return false
  const columnHeaders = headers?.length ? headers : Object.keys(rows[0])
  const esc = v => `"${String(v ?? '').replaceAll('"', '""')}"`
  const csv = [
    columnHeaders.join(','),
    ...rows.map(r => columnHeaders.map(h => esc(r[h])).join(',')),
  ].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
  return true
}

export function exportTxValidationsCsv(records, filename = 'dqa_tx_validations.csv', filters = {}) {
  const rows = txRecordsToExportRows(records, filters)
  if (!rows.length) return false
  return csvDownloadOrdered(filename, rows, txExportHeaders())
}

export function exportAggValidationsCsv(records, filename = 'dqa_aggregate_validations.csv', filters = {}) {
  const rows = aggRecordsToExportRows(records, filters)
  if (!rows.length) return false
  return csvDownloadOrdered(filename, rows, aggExportHeaders())
}
