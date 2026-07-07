import { compareTxField, normalizeTxId, recaptureCompleteness } from './dqa-entry'
import { reportAssessmentDate, reportDatimCode, reportLga, reportPeriod, reportPeriodFy } from './report-fields'
import { csvDownloadOrdered } from './validation-export'

/** Admin / identifier columns. */
export const TX_NEW_REPORT_ADMIN_HEADERS = [
  'Date of Assessment',
  'State',
  'LGA',
  'Period',
  'Period_FY',
  'Assessors',
  'Datim_Code',
  'FacilityName',
  'patient_id',
  'PepID',
  'Record FOUND (Yes/No)',
  'PatientHospitalNo',
]

/**
 * Comparable elements: each field is Folder | EMR | Result side by side.
 * Headings match the reference template exactly.
 */
export const TX_NEW_REPORT_COMPARABLE_FIELDS = [
  { key: 'sex', folder: 'Sex_Folder', emr: 'Sex_EMR', result: 'Sex_Result', folderDb: 'folderSex', emrDb: 'emrSex' },
  { key: 'ageatstartofart', folder: 'Ageatstartofart_Folder', emr: 'Ageatstartofart_EMR', result: 'Ageatstartofart_Result', folderDb: 'folderAge', emrDb: 'emrAge' },
  { key: 'artStartDate', folder: 'ARTStartDate_Folder', emr: 'ARTStartDate_EMR', result: 'ARTStartDate_Result', folderDb: 'folderArtStartDate', emrDb: 'emrArtStartDate' },
  { key: 'regimenLineAtArtStart', folder: 'RegimenLineAtARTStart_Folder', emr: 'RegimenLineAtARTStart_EMR', result: 'RegimenLineAtARTStart_Result', folderDb: 'folderRegimenLine', emrDb: 'emrRegimenLine' },
  { key: 'regimenAtArtStart', folder: 'RegimenAtARTStart_Folder', emr: 'RegimenAtARTStart_EMR', result: 'RegimenAtARTStart_Result', folderDb: 'folderRegimen', emrDb: 'emrRegimen' },
  { key: 'pharmacyLastPickupdate', folder: 'Pharmacy_LastPickupdate_Folder', emr: 'Pharmacy_LastPickupdate_EMR', result: 'Pharmacy_LastPickupdate_Result', folderDb: 'folderPharmacyPickup', emrDb: 'emrPharmacyPickup' },
  { key: 'daysOfArvRefill', folder: 'DaysOfARVRefill_Folder', emr: 'DaysOfARVRefill_EMR', result: 'DaysOfARVRefill_Result', folderDb: 'folderDaysRefill', emrDb: 'emrDaysRefill' },
  { key: 'currentTbStatus', folder: 'Current_TB_Status_Folder', emr: 'Current_TB_Status_EMR', result: 'Current_TB_Status_Result', folderDb: 'folderTbStatus', emrDb: 'emrTbStatus' },
  { key: 'currentPregnancyStatus', folder: 'CurrentPregnancyStatus_Folder', emr: 'CurrentPregnancyStatus_EMR', result: 'CurrentPregnancyStatus_Result', folderDb: 'folderPregnancy', emrDb: 'emrPregnancy' },
]

export const TX_NEW_REPORT_COMPARABLE_HEADERS = TX_NEW_REPORT_COMPARABLE_FIELDS.flatMap(
  field => [field.folder, field.emr, field.result],
)

/** Summary / EMR-only / metrics columns (after all comparable triplets). */
export const TX_NEW_REPORT_METRIC_HEADERS = [
  'PBS (Base Print)_EMR',
  'PBS_EMR_Completeness',
  'recapture_EMR',
  'recapture_EMR_Completeness',
  'date_of_recapture_EMR',
  'date_of_recapture_EMR_Completeness',
  'Folder_Complete_Count',
  'Folder_Completeness_%',
  'Match_Count',
  'Concurrence_%',
  'EMR_Only_Complete_Count',
  'EMR_Only_Completeness_%',
  'date_of_recapture_EMR_Validation',
  'Remarks/Comment',
]

/** Exact TX_NEW report column headings in export order (do not rename or abbreviate). */
export const TX_NEW_REPORT_HEADERS = [
  ...TX_NEW_REPORT_ADMIN_HEADERS,
  ...TX_NEW_REPORT_COMPARABLE_HEADERS,
  ...TX_NEW_REPORT_METRIC_HEADERS,
]

function passesReportFilters(record, filters = {}) {
  if (filters.period && record.period !== filters.period) return false
  if (filters.state && record.state !== filters.state) return false
  if (filters.facilityName && record.facilityName !== filters.facilityName) return false
  if (filters.lga && record.lga !== filters.lga) return false
  return true
}

function formatCell(value) {
  if (value === null || value === undefined) return ''
  return value
}

function formatPct(value) {
  if (value === null || value === undefined || value === '') return ''
  const num = Number(value)
  if (!Number.isFinite(num)) return formatCell(value)
  return Number.isInteger(num) ? String(num) : num.toFixed(1)
}

function txRowFromRecord(record) {
  return {
    sex: record.emrSex,
    ageatstartofart: record.emrAge,
    artStartDate: record.emrArtStartDate,
    regimenLineAtArtStart: record.emrRegimenLine,
    regimenAtArtStart: record.emrRegimen,
    pharmacyLastPickupdate: record.emrPharmacyPickup,
    daysOfArvRefill: record.emrDaysRefill,
    currentTbStatus: record.emrTbStatus,
    currentPregnancyStatus: record.emrPregnancy,
  }
}

function folderValuesFromRecord(record) {
  return {
    folderSex: record.folderSex,
    folderAge: record.folderAge,
    folderArtStart: record.folderArtStartDate,
    folderRegLine: record.folderRegimenLine,
    folderRegStart: record.folderRegimen,
    folderPickup: record.folderPharmacyPickup,
    folderRefill: record.folderDaysRefill,
    folderTb: record.folderTbStatus,
    folderPreg: record.folderPregnancy,
  }
}

function findPreloadRow(record, preloadRows) {
  if (!Array.isArray(preloadRows) || !preloadRows.length) return null
  const period = reportPeriod(record)
  const patientId = normalizeTxId(record.patientId)
  const pepId = normalizeTxId(record.pepId)
  const facility = String(record.facilityName || '').trim()

  return preloadRows.find(row => {
    if (String(row.facilityName || '').trim() !== facility) return false
    if (normalizeTxId(row.patientId) !== patientId) return false
    if (normalizeTxId(row.pepId) !== pepId) return false
    const rowPeriod = String(row.dqaPeriod || row.period || '').trim()
    if (period && rowPeriod && rowPeriod !== period) return false
    return true
  }) || null
}

function enrichTxReportRecord(record, preloadRows) {
  const preload = findPreloadRow(record, preloadRows)
  if (!preload) return record
  return {
    ...record,
    lga: record.lga || preload.lga || null,
    datimCode: record.datimCode || preload.datimCode || null,
    periodFy: record.periodFy || preload.periodFy || null,
    patientHospitalNo: record.patientHospitalNo || preload.patientHospitalNo || null,
  }
}

function periodFyFromRecord(record) {
  return reportPeriodFy(record)
}

function patientHospitalNoFromRecord(record) {
  return formatCell(record.patientHospitalNo ?? record.PatientHospitalNo)
}

function recaptureDateCompletenessFromRecord(record) {
  return formatCell(
    record.recaptureDateComplete
    ?? recaptureCompleteness(record.recaptureEmr, record.recaptureDate),
  )
}

function buildComparableColumns(record, txRow, folderValues) {
  const cols = {}
  for (const field of TX_NEW_REPORT_COMPARABLE_FIELDS) {
    cols[field.folder] = formatCell(record[field.folderDb])
    cols[field.emr] = formatCell(record[field.emrDb])
    cols[field.result] = formatCell(compareTxField(field.key, txRow, folderValues))
  }
  return cols
}

function buildAdminColumns(record) {
  return {
    Period: reportPeriod(record),
    'Date of Assessment': reportAssessmentDate(record),
    State: formatCell(record.state),
    LGA: reportLga(record),
    Datim_Code: reportDatimCode(record),
    Period_FY: periodFyFromRecord(record),
    Assessors: formatCell(record.assessor),
    FacilityName: formatCell(record.facilityName),
    patient_id: formatCell(record.patientId),
    PepID: formatCell(record.pepId),
    'Record FOUND (Yes/No)': formatCell(record.recordFound),
    PatientHospitalNo: patientHospitalNoFromRecord(record),
  }
}

function buildMetricColumns(record) {
  return {
    'PBS (Base Print)_EMR': formatCell(record.pbsEmr),
    PBS_EMR_Completeness: formatCell(record.pbsCompleteness),
    recapture_EMR: formatCell(record.recaptureEmr),
    recapture_EMR_Completeness: formatCell(record.recaptureCompleteness),
    date_of_recapture_EMR: formatCell(record.recaptureDate),
    date_of_recapture_EMR_Completeness: recaptureDateCompletenessFromRecord(record),
    Folder_Complete_Count: formatCell(record.folderCompleteCount),
    'Folder_Completeness_%': formatPct(record.folderCompletenessPct),
    Match_Count: formatCell(record.matchCount),
    'Concurrence_%': formatPct(record.concurrencePct),
    EMR_Only_Complete_Count: formatCell(record.emrOnlyCompleteCount),
    'EMR_Only_Completeness_%': formatPct(record.emrOnlyPct),
    date_of_recapture_EMR_Validation: formatCell(record.recaptureDateValid),
    'Remarks/Comment': formatCell(record.remarks),
  }
}

export function buildTxNewReportRows(txRecords, filters = {}, options = {}) {
  if (!Array.isArray(txRecords)) return []
  const preloadRows = options.preloadTx || []

  return txRecords
    .filter(record => passesReportFilters(record, filters))
    .sort((a, b) => {
      const state = String(a.state || '').localeCompare(String(b.state || ''))
      if (state !== 0) return state
      const lga = String(a.lga || '').localeCompare(String(b.lga || ''))
      if (lga !== 0) return lga
      const facility = String(a.facilityName || '').localeCompare(String(b.facilityName || ''))
      if (facility !== 0) return facility
      const pep = String(a.pepId || '').localeCompare(String(b.pepId || ''))
      if (pep !== 0) return pep
      return String(a.patientId || '').localeCompare(String(b.patientId || ''))
    })
    .map(record => {
      const enriched = enrichTxReportRecord(record, preloadRows)
      const txRow = txRowFromRecord(enriched)
      const folderValues = folderValuesFromRecord(enriched)
      const values = {
        ...buildAdminColumns(enriched),
        ...buildComparableColumns(enriched, txRow, folderValues),
        ...buildMetricColumns(enriched),
      }

      const ordered = {}
      for (const header of TX_NEW_REPORT_HEADERS) {
        ordered[header] = values[header] ?? ''
      }
      return ordered
    })
}

export function exportTxNewReportCsv(txRecords, filename = 'TX_NEW_Report.csv', filters = {}, options = {}) {
  const rows = buildTxNewReportRows(txRecords, filters, options)
  if (!rows.length) return false
  return csvDownloadOrdered(filename, rows, TX_NEW_REPORT_HEADERS)
}
