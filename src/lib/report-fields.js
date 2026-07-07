/** Shared Period / Date of Assessment values for TX_NEW and Aggregate exports. */

function formatValue(value) {
  if (value === null || value === undefined) return ''
  return value
}

export function reportPeriod(record) {
  return formatValue(record?.period ?? record?.dqaPeriod)
}

export function reportPeriodFy(record) {
  const direct = formatValue(record?.periodFy ?? record?.period_FY ?? record?.periodFY)
  if (direct) return direct
  const period = String(reportPeriod(record) || '')
  const match = period.match(/^(FY\d+)/i)
  return match ? match[1].toUpperCase() : ''
}

export function reportLga(record) {
  return formatValue(record?.lga ?? record?.LGA)
}

export function reportAssessmentDate(record) {
  return formatValue(record?.assessmentDate ?? record?.assessment_date)
}

export function reportDatimCode(record) {
  return formatValue(
    record?.datimCode
    ?? record?.Datim_Code
    ?? record?.datim_code
    ?? record?.DATIM,
  )
}
