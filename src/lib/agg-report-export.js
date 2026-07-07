import { aggClassification } from './dqa-entry'
import { reportAssessmentDate, reportDatimCode, reportLga, reportPeriod } from './report-fields'
import { csvDownloadOrdered } from './validation-export'

/** Exact aggregate report column headings (do not rename or abbreviate). */
export const AGG_REPORT_ADMIN_HEADERS = [
  'Date of Assessment',
  'State',
  'LGA',
  'Period',
  'Assessors',
  'Datim_Code',
  'FacilityName',
]

/** Indicators in reference order. */
export const AGG_REPORT_INDICATORS = [
  { key: 'HTS_TST', label: 'HTS_TST' },
  { key: 'HTS_TST_POS', label: 'HTS_TST_Pos' },
  { key: 'HTS_SELF', label: 'HTS_SELF' },
  { key: 'PMTCT_STAT', label: 'PMTCT_STAT' },
  { key: 'PMTCT_ART', label: 'PMTCT_ART' },
  { key: 'PMTCT_EID', label: 'PMTCT_EID' },
  { key: 'PMTCT_HEI_POS', label: 'PMTCT_HEI_POS' },
  { key: 'TX_TB', label: 'TX_TB' },
  { key: 'TB_STAT', label: 'TB_STAT' },
  { key: 'TX_NEW', label: 'TX_NEW' },
  { key: 'TB_PREV_Den', label: 'TB_PREV_Den' },
  { key: 'TB_PREV_Num', label: 'TB_PREV_Num' },
  { key: 'PreP_New', label: 'PreP_New' },
  { key: 'PMTCT_FO_Den', label: 'PMTCT_FO_Den' },
  { key: 'PMTCT_FO_Num', label: 'PMTCT_FO_Num' },
  { key: 'TB_ART', label: 'TB_ART' },
  { key: 'POST_RESP', label: 'POST_RESP' },
]

export const AGG_REPORT_INDICATOR_HEADERS = AGG_REPORT_INDICATORS.flatMap(ind => [
  `${ind.label} (Reported)`,
  `${ind.label} (Validated)`,
  `${ind.label} (Result)`,
])

export const AGG_REPORT_TAIL_HEADERS = [
  '__EMPTY',
]

export const AGG_REPORT_HEADERS = [
  ...AGG_REPORT_ADMIN_HEADERS,
  ...AGG_REPORT_INDICATOR_HEADERS,
  ...AGG_REPORT_TAIL_HEADERS,
]

const INDICATOR_KEY_ALIASES = {
  HTS_TST: 'HTS_TST',
  HTS_TST_POS: 'HTS_TST_POS',
  HTS_POS: 'HTS_TST_POS',
  HTS_SELF: 'HTS_SELF',
  HTS_TST_NEG: 'HTS_SELF',
  HTS_TST_SELF: 'HTS_SELF',
  PMTCT_STAT: 'PMTCT_STAT',
  PMTCT_ART: 'PMTCT_ART',
  PMTCT_EID: 'PMTCT_EID',
  PMTCT_HEI_POS: 'PMTCT_HEI_POS',
  HEI_POS: 'PMTCT_HEI_POS',
  TX_TB: 'TX_TB',
  TB_STAT: 'TB_STAT',
  TX_NEW: 'TX_NEW',
  TB_PREV_DEN: 'TB_PREV_Den',
  TB_PREV_Den: 'TB_PREV_Den',
  TX_CURR: 'TB_PREV_Den',
  TX_PREV: 'TB_PREV_Den',
  TB_PREV_NUM: 'TB_PREV_Num',
  TB_PREV_Num: 'TB_PREV_Num',
  PREP_NEW: 'PreP_New',
  PREPNEW: 'PreP_New',
  KPOP_NEW: 'PreP_New',
  K_POP_NEW: 'PreP_New',
  PMTCT_FO_DEN: 'PMTCT_FO_Den',
  PMTCT_FO_Den: 'PMTCT_FO_Den',
  PMTCT_FO_NUM: 'PMTCT_FO_Num',
  PMTCT_FO_Num: 'PMTCT_FO_Num',
  PMTCT_TO: 'PMTCT_FO_Den',
  PMTCT_TO_ART: 'PMTCT_FO_Num',
  TB_ART: 'TB_ART',
  POST_RESP: 'POST_RESP',
  POST_RDSP: 'POST_RESP',
  POST_DISP: 'POST_RESP',
  POST_RDSP_ASSESSMENT: 'POST_RESP',
}

function normalizeIndicatorToken(value) {
  return String(value || '')
    .trim()
    .replace(/\s*\(reported\)\s*/gi, '')
    .replace(/\s*\(validated\)\s*/gi, '')
    .replace(/[^\w]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function normalizeIndicatorKey(value) {
  const token = normalizeIndicatorToken(value)
  if (!token) return null
  const upper = token.toUpperCase()
  if (INDICATOR_KEY_ALIASES[upper]) return INDICATOR_KEY_ALIASES[upper]
  if (INDICATOR_KEY_ALIASES[token]) return INDICATOR_KEY_ALIASES[token]
  for (const [alias, key] of Object.entries(INDICATOR_KEY_ALIASES)) {
    const aliasUpper = alias.toUpperCase()
    if (upper === aliasUpper || upper.endsWith(`_${aliasUpper}`) || upper.includes(aliasUpper)) {
      return key
    }
  }
  return null
}

export function mapIndicatorToAggReportKey(indicator) {
  return normalizeIndicatorKey(indicator)
}

function facilityKey(record) {
  return [
    record.period || '',
    record.state || '',
    record.lga || '',
    record.facilityName || '',
  ].join('|')
}

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

function indicatorLabelForKey(key) {
  return AGG_REPORT_INDICATORS.find(ind => ind.key === key)?.label || key
}

function emptyIndicatorValues() {
  return Object.fromEntries(AGG_REPORT_INDICATOR_HEADERS.map(h => [h, '']))
}

function indicatorResult(reported, validated) {
  if (
    (reported === '' || reported === null || reported === undefined)
    && (validated === '' || validated === null || validated === undefined)
  ) {
    return ''
  }
  return aggClassification(reported ?? 0, validated ?? 0)
}

export function buildAggReportRows(aggRecords, filters = {}) {
  if (!Array.isArray(aggRecords)) return []

  const facilities = new Map()

  for (const record of aggRecords) {
    if (!passesReportFilters(record, filters)) continue
    const key = facilityKey(record)
    if (!facilities.has(key)) {
      facilities.set(key, {
        Period: reportPeriod(record),
        'Date of Assessment': reportAssessmentDate(record),
        State: formatCell(record.state),
        LGA: reportLga(record),
        Datim_Code: reportDatimCode(record),
        FacilityName: formatCell(record.facilityName),
        Assessors: formatCell(record.assessor),
        __EMPTY: '',
        indicators: emptyIndicatorValues(),
      })
    }

    const row = facilities.get(key)
    if (!row.Period && record.period) {
      row.Period = reportPeriod(record)
    }
    if (!row['Date of Assessment'] && record.assessmentDate) {
      row['Date of Assessment'] = reportAssessmentDate(record)
    }
    if (!row.Datim_Code && record.datimCode) {
      row.Datim_Code = reportDatimCode(record)
    }
    if (!row.LGA && record.lga) {
      row.LGA = reportLga(record)
    }
    if (!row.Assessors && record.assessor) {
      row.Assessors = formatCell(record.assessor)
    }

    const indicatorKey = mapIndicatorToAggReportKey(record.indicator)
    if (!indicatorKey) continue

    const label = indicatorLabelForKey(indicatorKey)
    const reportedCol = `${label} (Reported)`
    const validatedCol = `${label} (Validated)`
    const resultCol = `${label} (Result)`

    if (record.reported != null && record.reported !== '') {
      row.indicators[reportedCol] = formatCell(record.reported)
    }
    if (record.validated != null && record.validated !== '') {
      row.indicators[validatedCol] = formatCell(record.validated)
    }

    row.indicators[resultCol] = indicatorResult(
      row.indicators[reportedCol],
      row.indicators[validatedCol],
    )
  }

  return [...facilities.values()]
    .sort((a, b) => {
      const state = String(a.State).localeCompare(String(b.State))
      if (state !== 0) return state
      const lga = String(a.LGA).localeCompare(String(b.LGA))
      if (lga !== 0) return lga
      return String(a.FacilityName).localeCompare(String(b.FacilityName))
    })
    .map(row => ({
      'Date of Assessment': row['Date of Assessment'],
      State: row.State,
      LGA: row.LGA,
      Period: row.Period,
      Assessors: row.Assessors,
      Datim_Code: row.Datim_Code,
      FacilityName: row.FacilityName,
      ...row.indicators,
      __EMPTY: row.__EMPTY,
    }))
}

export function exportAggReportCsv(aggRecords, filename = 'Aggregate_Report.csv', filters = {}) {
  const rows = buildAggReportRows(aggRecords, filters)
  if (!rows.length) return false
  return csvDownloadOrdered(filename, rows, AGG_REPORT_HEADERS)
}
